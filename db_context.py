# db_context.py — referencia mutable al cliente Supabase activo
from database import supabase as _default

_current = [_default]

def get_db():
    return _current[0]

def set_db(client):
    _current[0] = client

def reset_db():
    _current[0] = _default
