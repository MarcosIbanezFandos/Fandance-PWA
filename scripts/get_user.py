"""Script de utilidad: busca el UUID de un usuario por email.

Uso (nunca en producción, solo en local):
    SUPABASE_URL=... SUPABASE_KEY=... TARGET_EMAIL=... python api/get_user.py

SUPABASE_KEY es la service_role key: bypassa RLS. Vive solo en el entorno,
jamás en el repositorio.
"""
import os

from supabase import Client, create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
TARGET_EMAIL = os.environ["TARGET_EMAIL"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    response = supabase.auth.admin.list_users()
    for u in response:
        if hasattr(u, 'email') and u.email == TARGET_EMAIL:
            print(f"FOUND: {u.id}")
            break
except Exception as e:
    print(e)
