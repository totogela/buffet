from supabase import create_client, Client
import os

SUPABASE_URL_DEMO = "https://yxwjanlgdaetffthoflb.supabase.co"
SUPABASE_KEY_DEMO = os.getenv("SUPABASE_KEY_DEMO", "sb_publishable_22f0CL8ExYRrwWU2EvcD7g_BaDsteu9")

supabase_demo: Client = create_client(SUPABASE_URL_DEMO, SUPABASE_KEY_DEMO)
