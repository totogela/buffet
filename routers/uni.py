from database_demo import supabase_demo as supabase
import routers.ventas as v_mod
import routers.gastos as g_mod
import routers.caja as c_mod
import routers.proveedores as p_mod
import routers.cuentas as cu_mod

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

uni_app = FastAPI()
uni_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_orig = {
    'v': v_mod.supabase, 'g': g_mod.supabase,
    'c': c_mod.supabase, 'p': p_mod.supabase, 'cu': cu_mod.supabase
}

@uni_app.middleware("http")
async def inject_uni_db(request, call_next):
    v_mod.supabase = supabase
    g_mod.supabase = supabase
    c_mod.supabase = supabase
    p_mod.supabase = supabase
    cu_mod.supabase = supabase
    response = await call_next(request)
    v_mod.supabase = _orig['v']
    g_mod.supabase = _orig['g']
    c_mod.supabase = _orig['c']
    p_mod.supabase = _orig['p']
    cu_mod.supabase = _orig['cu']
    return response

uni_app.include_router(v_mod.router)
uni_app.include_router(g_mod.router)
uni_app.include_router(c_mod.router)
uni_app.include_router(p_mod.router)
uni_app.include_router(cu_mod.router)
