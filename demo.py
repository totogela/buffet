from fastapi import APIRouter
from database_demo import supabase_demo as supabase
from routers.ventas import router as ventas_router
from routers.gastos import router as gastos_router
from routers.caja import router as caja_router

# Re-exporta todos los endpoints pero con supabase demo
# La forma más simple: un sub-app montado en /demo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import routers.ventas as v_mod
import routers.gastos as g_mod
import routers.caja as c_mod

demo_app = FastAPI()
demo_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Monkey-patch supabase para los módulos del demo
_orig_v = v_mod.supabase
_orig_g = g_mod.supabase
_orig_c = c_mod.supabase

@demo_app.middleware("http")
async def inject_demo_db(request, call_next):
    v_mod.supabase = supabase
    g_mod.supabase = supabase
    c_mod.supabase = supabase
    response = await call_next(request)
    v_mod.supabase = _orig_v
    g_mod.supabase = _orig_g
    c_mod.supabase = _orig_c
    return response

demo_app.include_router(ventas_router)
demo_app.include_router(gastos_router)
demo_app.include_router(caja_router)
