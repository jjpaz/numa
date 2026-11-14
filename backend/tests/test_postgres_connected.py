"""Opt-in Aiven/PostgreSQL tests. Never substitute mocks for real persistence."""
import os
import secrets
import pytest
from backend.repository import Repository,dedicated_test_url
from backend.tests.test_storage_resilience import exercise_restart

pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='BLOQUEADA: dedicated TEST_DATABASE_URL not configured')


def test_real_postgres_crud_and_restart_all_data(monkeypatch):
    url=dedicated_test_url()
    prefix='verify-'+secrets.token_hex(10)
    repo=Repository(url)
    try:
        repo.put('verification',prefix,{'value':1},prefix)
        assert repo.get('verification',prefix)=={'value':1}
        repo.put('verification',prefix,{'value':2},prefix)
        reopened=Repository(url)
        try:assert reopened.get('verification',prefix)=={'value':2}
        finally:reopened.close()
        repo.delete('verification',prefix)
        assert repo.get('verification',prefix) is None
        restarted,_=exercise_restart(lambda:Repository(url),monkeypatch,prefix)
        restarted.close()
    finally:
        # Exact IDs and owner scope of this run only; never purge tables.
        for owner in [prefix+'-patient',prefix+'-other',prefix+'-clinician']:
            for collection in ['entries','experiments','notes']:
                for row in repo.all(collection,owner):
                    repo.delete(collection,row.get('id',owner))
            repo.delete('notes',owner)
            repo.delete('users',owner)
        repo.delete('verification',prefix)
        repo.close()
