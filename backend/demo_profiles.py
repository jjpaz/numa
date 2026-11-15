"""Named profiles for the explicitly enabled, password-free presentation demo."""
import hashlib
import unicodedata


def normalize_demo_name(value):
    return ' '.join(unicodedata.normalize('NFKC', value).split())


def named_patient(repo, name):
    # Stable across process restarts and signing-secret rotation. The compact
    # key leaves room for an 80-character request ID in the 128-character PK.
    key = 'patient-demo-' + hashlib.sha256(name.casefold().encode('utf-8')).hexdigest()[:32]
    with repo.lock:
        user = repo.get('users', key)
        if user is None:
            user = repo.put('users', key, {
                'id': key, 'name': name, 'email': key + '@numa.demo',
                'role': 'patient', 'source': 'live', 'demo_named': True,
                'preferences': ['walk', 'music', 'breathe', 'connect'],
            })
        clinician = repo.get('users', 'psychologist')
        assigned = clinician.get('assigned', [])
        if key not in assigned:
            repo.put('users', 'psychologist', {**clinician, 'assigned': [*assigned, key]})
    return user
