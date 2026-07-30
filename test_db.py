import os
from supabase import create_client, Client
url = "https://REDACTED_PROJECT_REF.supabase.co"
key = "REDACTED_SUPABASE_SERVICE_ROLE_KEY"
supabase: Client = create_client(url, key)
res = supabase.table("portfolios").select("*").execute()
print(res)
