from db_context import set_db, reset_db
from database_demo import supabase_demo
import routers.ventas as v_mod
import routers.gastos as g_mod
import routers.caja as c_mod
import routers.proveedores as p_mod
import routers.cuentas as cu_mod

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

uni_app = FastAPI()
uni_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@uni_app.middleware("http")
async def inject_uni_db(request, call_next):
    set_db(supabase_demo)
    try:
        response = await call_next(request)
    finally:
        reset_db()
    return response

uni_app.include_router(v_mod.router)
uni_app.include_router(g_mod.router)
uni_app.include_router(c_mod.router)
uni_app.include_router(p_mod.router)
uni_app.include_router(cu_mod.router)
