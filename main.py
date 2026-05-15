from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ventas, gastos, caja, proveedores, cuentas
from routers.demo import demo_app

app = FastAPI(
    title="Buffet Escolar API",
    description="Sistema de gestión para buffet escolar",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ventas.router)
app.include_router(gastos.router)
app.include_router(caja.router)
app.include_router(proveedores.router)
app.include_router(cuentas.router)
app.mount("/demo", demo_app)

@app.get("/")
def root():
    return {"status": "ok", "app": "Buffet Escolar API v1.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}
