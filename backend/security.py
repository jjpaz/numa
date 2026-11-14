import base64
import hashlib
import hmac
import json
import time
import secrets
from fastapi import HTTPException

def issue_token(user_id, secret, display_name=None):
    claims={'sub':user_id,'exp':int(time.time())+8*3600,'nonce':secrets.token_hex(8)}
    if display_name is not None: claims['display_name']=display_name
    body = base64.urlsafe_b64encode(json.dumps(claims,separators=(',',':')).encode()).decode().rstrip('=')
    sig = hmac.new(secret.encode(),body.encode(),hashlib.sha256).hexdigest()
    return f'{body}.{sig}'

def verify_session(token, secret):
    try:
        body,sig = token.split('.')
        expected = hmac.new(secret.encode(),body.encode(),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig,expected): raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
        if data['exp'] <= time.time(): raise ValueError()
        if not isinstance(data['sub'],str): raise ValueError()
        if 'display_name' in data and (not isinstance(data['display_name'],str) or not 1<=len(data['display_name'])<=80): raise ValueError()
        return data
    except (ValueError,KeyError,TypeError):
        raise HTTPException(401,'Session expired. Please sign in again.')

def verify_token(token, secret):
    return verify_session(token,secret)['sub']
