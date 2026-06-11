from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db_context import get_db
from auth import usuario_actual

router = APIRouter(prefix="/gastos", tags=["Gastos"])

class GastoCreate(BaseModel):
    monto: float
    descripcion: Optional[str] = None
    categoria_id: Optional[str] = None
    foto_url: Optional[str] = None
    metodo_pago: Optional[str] = "efectivo"  # "efectivo" | "transferencia"
    fecha: Optional[str] = None  # YYYY-MM-DD para registrar en fecha pasada

@router.post("/")
def crear_gasto(gasto: GastoCreate, user: dict = Depends(usuario_actual)):
    if gasto.metodo_pago not in ["efectivo", "transferencia", None]:
        raise HTTPException(400, "metodo_pago debe ser 'efectivo' o 'transferencia'")
    payload = {k: v for k, v in gasto.model_dump().items() if v is not None and k != "fecha"}
    if "categoria_id" in payload and not payload["categoria_id"]:
        del payload["categoria_id"]
    payload["usuario_id"] = user["id"]
    if gasto.fecha:
        payload["fecha"] = f"{gasto.fecha}T12:00:00-03:00"
    try:
        res = get_db().table("gastos").insert(payload).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al insertar en Supabase: {str(e)}")
    if not res.data:
        raise HTTPException(status_code=500, detail="Supabase no devolvió datos. Verificá permisos RLS de la tabla 'gastos'.")
    return res.data[0]

@router.get("/")
def listar_gastos(dias: int = 30, user: dict = Depends(usuario_actual)):
    from datetime import datetime, timedelta, timezone
    tz_ar = timezone(timedelta(hours=-3))
    ahora_ar = datetime.now(tz_ar)
    desde_ar = (ahora_ar - timedelta(days=dias - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    hasta_ar = ahora_ar.replace(hour=23, minute=59, second=59, microsecond=0)
    res = (
        get_db().table("gastos")
        .select("*, categorias_gasto(nombre)")
        .eq("usuario_id", user["id"])
        .gte("fecha", desde_ar.isoformat())
        .lte("fecha", hasta_ar.isoformat())
        .order("fecha", desc=True)
        .execute()
    )
    return res.data

@router.get("/categorias")
def listar_categorias():
    res = get_db().table("categorias_gasto").select("*").execute()
    return res.data

@router.get("/diagnostico")
def diagnostico_gastos(user: dict = Depends(usuario_actual)):
    """Endpoint de diagnóstico: verifica conexión con la tabla gastos"""
    resultado = {}
    try:
        res = get_db().table("gastos").select("id, monto, fecha").eq("usuario_id", user["id"]).limit(1).execute()
        resultado["lectura"] = "OK"
        resultado["filas_encontradas"] = len(res.data)
    except Exception as e:
        resultado["lectura"] = f"ERROR: {str(e)}"

    try:
        import uuid
        res = get_db().table("gastos").insert({
            "monto": 0.01,
            "descripcion": "TEST_DIAGNOSTICO",
            "usuario_id": user["id"],
        }).execute()
        if res.data:
            # Eliminar el registro de prueba
            get_db().table("gastos").delete().eq("id", res.data[0]["id"]).execute()
            resultado["escritura"] = "OK"
        else:
            resultado["escritura"] = "ERROR: Supabase no devolvió datos (posible RLS bloqueando INSERT)"
    except Exception as e:
        resultado["escritura"] = f"ERROR: {str(e)}"

    return resultado


@router.delete("/{gasto_id}")
def eliminar_gasto(gasto_id: str, user: dict = Depends(usuario_actual)):
    res = get_db().table("gastos").delete().eq("id", gasto_id).eq("usuario_id", user["id"]).execute()
    if not res.data:
        raise HTTPException(404, "Gasto no encontrado")
    return {"ok": True}
