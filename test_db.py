"""Comprobación manual de conectividad con Supabase.

Uso (solo en local):
    SUPABASE_URL=... SUPABASE_KEY=... python test_db.py

SUPABASE_KEY es la service_role key: bypassa RLS. Vive solo en el entorno,
jamás en el repositorio.
"""
import os

from supabase import Client, create_client

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(url, key)
res = supabase.table("portfolios").select("*").execute()
print(res)
