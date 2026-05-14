from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import supabase

router = APIRouter(prefix="/gastos", tags=["Gastos"])

class GastoCreate(BaseModel):
    monto: float
    descripcion: Optional[str] = None
    categoria_id: Optional[str] = None
    foto_url: Optional[str] = None
    metodo_pago: Optional[str] = "efectivo"  # "efectivo" | "transferencia"

@router.post("/")
def crear_gasto(gasto: GastoCreate):
    if gasto.metodo_pago not in ["efectivo", "transferencia", None]:
        raise HTTPException(400, "metodo_pago debe ser 'efectivo' o 'transferencia'")
    payload = {k: v for k, v in gasto.model_dump().items() if v is not None}
    if "categoria_id" in payload and not payload["categoria_id"]:
        del payload["categoria_id"]
    try:
        res = supabase.table("gastos").insert(payload).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al insertar en Supabase: {str(e)}")
    if not res.data:
        raise HTTPException(status_code=500, detail="Supabase no devolvió datos. Verificá permisos RLS de la tabla 'gastos'.")
    return res.data[0]

@router.get("/")
def listar_gastos(dias: int = 30):
    from datetime import datetime, timedelta, timezone
    tz_ar = timezone(timedelta(hours=-3))
    ahora_ar = datetime.now(tz_ar)
    desde_ar = (ahora_ar - timedelta(days=dias - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    hasta_ar = ahora_ar.replace(hour=23, minute=59, second=59, microsecond=0)
    res = (
        supabase.table("gastos")
        .select("*, categorias_gasto(nombre)")
        .gte("fecha", desde_ar.isoformat())
        .lte("fecha", hasta_ar.isoformat())
        .order("fecha", desc=True)
        .execute()
    )
    return res.data

@router.get("/categorias")
def listar_categorias():
    res = supabase.table("categorias_gasto").select("*").execute()
    return res.data

@router.get("/diagnostico")
def diagnostico_gastos():
    """Endpoint de diagnóstico: verifica conexión con la tabla gastos"""
    resultado = {}
    try:
        res = supabase.table("gastos").select("id, monto, fecha").limit(1).execute()
        resultado["lectura"] = "OK"
        resultado["filas_encontradas"] = len(res.data)
    except Exception as e:
        resultado["lectura"] = f"ERROR: {str(e)}"

    try:
        import uuid
        res = supabase.table("gastos").insert({
            "monto": 0.01,
            "descripcion": "TEST_DIAGNOSTICO"
        }).execute()
        if res.data:
            # Eliminar el registro de prueba
            supabase.table("gastos").delete().eq("id", res.data[0]["id"]).execute()
            resultado["escritura"] = "OK"
        else:
            resultado["escritura"] = "ERROR: Supabase no devolvió datos (posible RLS bloqueando INSERT)"
    except Exception as e:
        resultado["escritura"] = f"ERROR: {str(e)}"

    return resultado


@router.delete("/{gasto_id}")
def eliminar_gasto(gasto_id: str):
    res = supabase.table("gastos").delete().eq("id", gasto_id).execute()
    if not res.data:
        raise HTTPException(404, "Gasto no encontrado")
    return {"ok": True}
