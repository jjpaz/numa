"""PostgreSQL only; bounded volatile changes survive recoverable connection errors."""
import copy
import os
import json
import tempfile
from pathlib import Path
import threading
from sqlalchemy import create_engine, MetaData, Table, Column, String, JSON, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, DisconnectionError, OperationalError, TimeoutError

class StorageUnavailable(RuntimeError):
    pass

def validate_database_url(value):
    try: url=make_url(value)
    except Exception: raise ValueError('Invalid PostgreSQL configuration.') from None
    if url.drivername not in ('postgresql','postgresql+psycopg'):
        raise ValueError('Numa requires PostgreSQL; no second database backend is supported.')
    if url.query.get('sslmode') not in ('require','verify-ca','verify-full'):
        raise ValueError('PostgreSQL requires explicit TLS; use sslmode=verify-full with the Aiven CA.')
    return url.set(drivername='postgresql+psycopg')

def dedicated_test_url():
    value=os.getenv('TEST_DATABASE_URL','').strip()
    if not value:return None
    target=validate_database_url(value)
    production=os.getenv('DATABASE_URL','').strip()
    if not production:raise ValueError('Set DATABASE_URL too to verify test database separation.')
    live=validate_database_url(production)
    identity=lambda u:((u.host or '').lower(),u.port or 5432,u.database)
    if identity(target)==identity(live):raise ValueError('TEST_DATABASE_URL must identify a different database.')
    return value

def recoverable(error):
    if isinstance(error,(OperationalError,DisconnectionError,TimeoutError)):return True
    code=getattr(getattr(error,'orig',None),'sqlstate','') or ''
    return isinstance(error,DBAPIError) and (error.connection_invalidated or code.startswith('08') or code in ('40001','40P01','53300','57P01'))

class Repository:
    def __init__(self, database_url=None, demo=False):
        database_url = database_url.strip() if database_url else None
        self.lock = threading.RLock()
        self.memory = {}
        self.pending = {}
        self.uncertain = set()
        self.conflicts = set()
        self.pending_limit = 128
        self._ca_path = None
        self.engine = None
        if database_url:
            url=validate_database_url(database_url)
            options={'connect_timeout':10,'options':'-c statement_timeout=10000'}
            certificate=os.getenv('NUMA_DATABASE_CA_CERT','').strip()
            if certificate:
                with tempfile.NamedTemporaryFile(prefix='numa-db-ca-',suffix='.pem',delete=False) as handle:
                    self._ca_path=Path(handle.name)
                    os.chmod(handle.name,0o600)
                    handle.write(certificate.encode())
                options['sslrootcert']=str(self._ca_path)
            self.engine = create_engine(url, pool_pre_ping=True,pool_size=2,max_overflow=0,pool_timeout=10,hide_parameters=True,connect_args=options)
            meta = MetaData()
            self.rows = Table('numa_records', meta, Column('collection',String(40),primary_key=True), Column('id',String(128),primary_key=True), Column('owner',String(128),index=True), Column('payload',JSON,nullable=False))
            try:meta.create_all(self.engine)
            except Exception:
                self.close()
                raise StorageUnavailable('PostgreSQL initialization failed; check TLS and availability.') from None
        elif not demo:
            raise RuntimeError('DATABASE_URL required outside explicit NUMA_DEMO_MODE=true.')

    def close(self):
        if self.engine is not None:self.engine.dispose()
        if self._ca_path is not None:self._ca_path.unlink(missing_ok=True)

    def _db_put(self,collection,key,value,owner):
        stmt=insert(self.rows).values(collection=collection,id=key,owner=owner,payload=value)
        with self.engine.begin() as conn:
            conn.execute(stmt.on_conflict_do_update(index_elements=['collection','id'],set_={'owner':owner,'payload':value}))

    def _db_get(self,collection,key):
        with self.engine.connect() as conn:
            row=conn.execute(select(self.rows.c.owner,self.rows.c.payload).where(self.rows.c.collection==collection,self.rows.c.id==key)).first()
            return (row[0],row[1]) if row else None

    def _db_all(self,collection,owner):
        stmt=select(self.rows.c.id,self.rows.c.owner,self.rows.c.payload).where(self.rows.c.collection==collection)
        if owner is not None:stmt=stmt.where(self.rows.c.owner==owner)
        with self.engine.connect() as conn:return {r[0]:(r[1],r[2]) for r in conn.execute(stmt)}

    def _db_delete(self,collection,key):
        with self.engine.begin() as conn:conn.execute(self.rows.delete().where(self.rows.c.collection==collection,self.rows.c.id==key))

    def _flush(self):
        for (collection,key),record in list(self.pending.items()):
            try:
                if record is not None and (collection,key) in self.uncertain:
                    existing=self._db_get(collection,key)
                    if existing is not None and existing!=record:
                        self.conflicts.add((collection,key))
                        continue  # Preserve both the original DB row and the temporary words.
                if record is None:self._db_delete(collection,key)
                else:self._db_put(collection,key,record[1],record[0])
            except Exception as exc:
                if recoverable(exc):return
                raise StorageUnavailable('A queued change could not be confirmed.') from None
            self.pending.pop((collection,key),None)
            self.uncertain.discard((collection,key))
            self.conflicts.discard((collection,key))

    def _view(self,collection,key,payload):
        result=copy.deepcopy(payload)
        if collection=='entries':
            result['persistence_status']='ephemeral' if self.engine is None else 'pending_retry' if (collection,key) in self.pending else 'persisted'
            if result['persistence_status']=='pending_retry':
                result['persistence_warning']='Saved temporarily in this process; not durable until PostgreSQL confirms. A restart can lose pending changes.'
            if (collection,key) in self.conflicts:
                result.update(persistence_status='conflict',persistence_warning='An existing database record conflicts with these temporary words. Keep a copy and save with a new request ID.')
        return result

    def put(self,collection,key,value,owner=''):
        payload=copy.deepcopy(value)
        if collection=='entries':
            for field in ('persistence_status','persistence_warning'):payload.pop(field,None)
        json.dumps(payload,allow_nan=False)  # rejects bytes; raw audio is never queued
        with self.lock:
            if self.engine is not None:
                try:
                    if (collection,key) in self.uncertain:raise TimeoutError('Record existence not confirmed.')
                    self._db_put(collection,key,payload,owner)
                except Exception as exc:
                    if not recoverable(exc):raise StorageUnavailable('Database change could not be confirmed.') from None
                    if (collection,key) not in self.pending and len(self.pending)>=self.pending_limit:
                        raise StorageUnavailable('Temporary save buffer full. Keep your words and retry.') from None
                    self.pending[(collection,key)]=(owner,payload)
                else:self.pending.pop((collection,key),None)
            self.memory[(collection,key)]=(owner,payload)
            return self._view(collection,key,payload)

    def get(self,collection,key):
        with self.lock:
            identity=(collection,key)
            if self.engine is not None:
                self._flush()
                if identity not in self.pending:
                    try:record=self._db_get(collection,key)
                    except Exception as exc:
                        if not recoverable(exc):raise StorageUnavailable('Database read unavailable.') from None
                        if identity not in self.memory:
                            if collection=='entries':
                                self.uncertain.add(identity)
                                return None
                            raise StorageUnavailable('Database unavailable and record not cached.') from None
                    else:
                        if record is None:self.memory.pop(identity,None)
                        else:self.memory[identity]=record
            record=self.memory.get(identity)
            return self._view(collection,key,record[1]) if record else None

    def all(self,collection,owner=None):
        with self.lock:
            if self.engine is not None:
                self._flush()
                try:records=self._db_all(collection,owner)
                except Exception as exc:
                    if not recoverable(exc):raise StorageUnavailable('Database list unavailable.') from None
                    records={k:r for (c,k),r in self.memory.items() if c==collection and (owner is None or r[0]==owner)}
                else:
                    for (c,k),r in list(self.memory.items()):
                        if c==collection and (owner is None or r[0]==owner) and (c,k) not in self.pending:self.memory.pop((c,k),None)
                    self.memory.update({(collection,k):r for k,r in records.items()})
                for (c,k),r in self.pending.items():
                    if c!=collection:continue
                    records.pop(k,None)
                    if r is not None and (owner is None or r[0]==owner):records[k]=r
            else:records={k:r for (c,k),r in self.memory.items() if c==collection and (owner is None or r[0]==owner)}
            return [self._view(collection,k,r[1]) for k,r in records.items()]

    def delete(self,collection,key):
        with self.lock:
            if self.engine is not None:
                try:self._db_delete(collection,key)
                except Exception as exc:
                    if not recoverable(exc):raise StorageUnavailable('Database deletion could not be confirmed.') from None
                    if (collection,key) not in self.pending and len(self.pending)>=self.pending_limit:raise StorageUnavailable('Temporary save buffer full.') from None
                    self.pending[(collection,key)]=None
                else:self.pending.pop((collection,key),None)
            self.memory.pop((collection,key),None)
