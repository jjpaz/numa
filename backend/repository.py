"""One persistent datastore: PostgreSQL. Explicit ephemeral demo mode for local previews."""
import copy
import os
import threading
from sqlalchemy import create_engine, MetaData, Table, Column, String, JSON, select
from sqlalchemy.dialects.postgresql import insert

class Repository:
    def __init__(self, database_url=None, demo=False):
        database_url = database_url.strip() if database_url else None
        self.lock = threading.RLock()
        self.memory = {}
        self.engine = None
        if database_url:
            if not database_url.startswith(('postgresql://','postgresql+psycopg://')):
                raise ValueError('Numa requires PostgreSQL; no second database backend is supported.')
            self.engine = create_engine(database_url.replace('postgresql://','postgresql+psycopg://',1), pool_pre_ping=True)
            meta = MetaData()
            self.rows = Table('numa_records', meta, Column('collection',String(40),primary_key=True), Column('id',String(128),primary_key=True), Column('owner',String(128),index=True), Column('payload',JSON,nullable=False))
            meta.create_all(self.engine)
        elif not demo:
            raise RuntimeError('DATABASE_URL required outside explicit NUMA_DEMO_MODE=true.')

    def put(self, collection, key, value, owner=''):
        with self.lock:
            if self.engine:
                stmt = insert(self.rows).values(collection=collection,id=key,owner=owner,payload=value)
                with self.engine.begin() as conn:
                    conn.execute(stmt.on_conflict_do_update(index_elements=['collection','id'],set_={'owner':owner,'payload':value}))
            else:
                self.memory[(collection,key)] = (owner,copy.deepcopy(value))
        return copy.deepcopy(value)

    def get(self, collection, key):
        with self.lock:
            if self.engine:
                with self.engine.connect() as conn:
                    row = conn.execute(select(self.rows.c.payload).where(self.rows.c.collection==collection,self.rows.c.id==key)).first()
                    return copy.deepcopy(row[0]) if row else None
            value = self.memory.get((collection,key))
            return copy.deepcopy(value[1]) if value else None

    def all(self, collection, owner=None):
        with self.lock:
            if self.engine:
                stmt = select(self.rows.c.payload).where(self.rows.c.collection==collection)
                if owner is not None: stmt = stmt.where(self.rows.c.owner==owner)
                with self.engine.connect() as conn:
                    return [copy.deepcopy(r[0]) for r in conn.execute(stmt)]
            return [copy.deepcopy(v) for (c,k),(o,v) in self.memory.items() if c==collection and (owner is None or owner==o)]

    def delete(self, collection, key):
        with self.lock:
            if self.engine:
                with self.engine.begin() as conn:
                    conn.execute(self.rows.delete().where(self.rows.c.collection==collection,self.rows.c.id==key))
            else:
                self.memory.pop((collection,key),None)
