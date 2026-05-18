from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date
from database import supabase

router = APIRouter(prefix="/ventas", tags=["Ventas"])

class VentaCreate(BaseModel):
    monto: float
    metodo_pago: str  # "efectivo" | "transferencia"

@router.post("/")
def crear_venta(venta: VentaCreate):
    if venta.metodo_pago not in ["efectivo", "transferencia"]:
        raise HTTPException(400, "metodo_pago debe ser 'efectivo' o 'transferencia'")
    res = supabase.table("ventas").insert({
        "monto": venta.monto,
        "metodo_pago": venta.metodo_pago
    }).execute()
    return res.data[0]

@router.delete("/{venta_id}/anular")
def anular_venta(venta_id: str):
    res = supabase.table("ventas").update({"anulada": True}).eq("id", venta_id).execute()
    if not res.data:
        raise HTTPException(404, "Venta no encontrada")
    return {"ok": True}

@router.get("/hoy")
def ventas_hoy():
    from datetime import datetime, timedelta, timezone
    tz_ar = timezone(timedelta(hours=-3))
    ahora_ar = datetime.now(tz_ar)
    hoy = ahora_ar.date().isoformat()
    desde = ahora_ar.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    hasta = ahora_ar.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()

    res = supabase.table("resumen_ventas_diario").select("*").eq("dia", hoy).execute()
    ventas = res.data[0] if res.data else {"dia": hoy, "cantidad_ventas": 0, "total": 0, "total_efectivo": 0, "total_transferencia": 0}

    gastos_res = supabase.table("gastos").select("monto, metodo_pago").gte("fecha", desde).lte("fecha", hasta).execute()
    gastos_efectivo = sum(float(g["monto"]) for g in gastos_res.data if g.get("metodo_pago", "efectivo") == "efectivo")
    gastos_transferencia = sum(float(g["monto"]) for g in gastos_res.data if g.get("metodo_pago") == "transferencia")
    total_gastos = round(gastos_efectivo + gastos_transferencia, 2)

    total_ventas = float(ventas.get("total", 0))
    total_efectivo = float(ventas.get("total_efectivo", 0))
    total_transferencia = float(ventas.get("total_transferencia", 0))
    ganancia_neta = round(total_ventas - total_gastos, 2)
    efectivo_neto = round(total_efectivo - gastos_efectivo, 2)
    transferencia_neta = round(total_transferencia - gastos_transferencia, 2)

    return {
        **ventas,
        "total_gastos": total_gastos,
        "ganancia_neta": ganancia_neta,
        "efectivo_neto": efectivo_neto,
        "total_transferencia": transferencia_neta,
    }

@router.get("/resumen")
def resumen_ventas(dias: int = 30):
    res = supabase.table("resumen_ventas_diario").select("*").limit(dias).execute()
    return res.data

@router.get("/recientes")
def ventas_recientes(limite: int = 20):
    res = supabase.table("ventas").select("*").eq("anulada", False).order("fecha", desc=True).limit(limite).execute()
    return res.data


@router.get("/dia/{fecha}")
def ventas_por_dia(fecha: str):
    """Devuelve ventas, gastos y cierre de un día específico. fecha: YYYY-MM-DD"""
    from datetime import datetime, timedelta, timezone
    tz_ar = timezone(timedelta(hours=-3))
    desde = f"{fecha}T00:00:00-03:00"
    hasta = f"{fecha}T23:59:59-03:00"

    ventas = supabase.table("ventas").select("*").gte("fecha", desde).lte("fecha", hasta).order("fecha", desc=True).execute()
    gastos = supabase.table("gastos").select("*, categorias_gasto(nombre)").gte("fecha", desde).lte("fecha", hasta).order("fecha", desc=True).execute()
    cierre = supabase.table("cierres_caja").select("*").or_(f"fecha.eq.{fecha},cerrado_en.gte.{desde}").execute()

    total_ventas = sum(float(v["monto"]) for v in ventas.data if not v.get("anulada"))
    total_gastos = sum(float(g["monto"]) for g in gastos.data)

    return {
        "fecha": fecha,
        "ventas": ventas.data,
        "gastos": gastos.data,
        "cierres": cierre.data,
        "resumen": {
            "total_ventas": round(total_ventas, 2),
            "total_gastos": round(total_gastos, 2),
            "ganancia": round(total_ventas - total_gastos, 2),
            "cantidad_ventas": len([v for v in ventas.data if not v.get("anulada")]),
        }
    }
