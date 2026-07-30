import os
from supabase import create_client, Client
import json

SUPABASE_URL = "https://rozjdmysesczntcdseho.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvempkbXlzZXNjem50Y2RzZWhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0MDEzNCwiZXhwIjoyMDg2NDE2MTM0fQ.u_FYfPaBALigrvVmZPYhR-qVW__Yndc3binSWoe3X0Y"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    response = supabase.auth.admin.list_users()
    for u in response:
        if hasattr(u, 'email') and u.email == 'marcosibanezfandos@gmail.com':
            print(f"FOUND: {u.id}")
            break
except Exception as e:
    print(e)
