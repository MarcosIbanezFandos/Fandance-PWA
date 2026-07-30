import os
from supabase import create_client, Client
import json

SUPABASE_URL = "https://REDACTED_PROJECT_REF.supabase.co"
SUPABASE_KEY = "REDACTED_SUPABASE_SERVICE_ROLE_KEY"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    response = supabase.auth.admin.list_users()
    for u in response:
        if hasattr(u, 'email') and u.email == 'marcosibanezfandos@gmail.com':
            print(f"FOUND: {u.id}")
            break
except Exception as e:
    print(e)
