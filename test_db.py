import os
from supabase import create_client, Client
url = "https://rozjdmysesczntcdseho.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvempkbXlzZXNjem50Y2RzZWhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0MDEzNCwiZXhwIjoyMDg2NDE2MTM0fQ.u_FYfPaBALigrvVmZPYhR-qVW__Yndc3binSWoe3X0Y"
supabase: Client = create_client(url, key)
res = supabase.table("portfolios").select("*").execute()
print(res)
