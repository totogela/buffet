from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import supabase

router = APIRouter(prefix="/caja", tags=["Caja"])


class AbrirCaja(BaseModel):
    monto_inicial: float
    fecha: Optional[str] = None
    nota_apertura: Optional[str] = None


class CerrarCaja(BaseModel):
    monto_contado: float
    monto_contado_efectivo: float
    monto_contado_transferencia: float
    nota: Optional[str] = None


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fecha_hoy() -> str:
    return date.today().isoformat()


def caja_abierta_actual():
    res = (
        supabase.table("cierres_caja")
        .select("*")
        .eq("cerrada", False)
        .order("abierto_en", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def calcular_montos_sistema(caja: dict) -> dict:
    desde = caja.get("abierto_en") or f"{caja.get('fecha', fecha_hoy())}T00:00:00"
    hasta = ahora_iso()

    ventas = (
        supabase.table("ventas")
        .select("monto, metodo_pago")
        .eq("anulada", False)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .execute()
    )
    ventas_efectivo = sum(float(v["monto"]) for v in ventas.data if v.get("metodo_pago") == "efectivo")
    ventas_transferencia = sum(float(v["monto"]) for v in ventas.data if v.get("metodo_pago") == "transferencia")
    cantidad_ventas = len([v for v in ventas.data if not v.get("anulada")])

    gastos = (
        supabase.table("gastos")
        .select("monto, metodo_pago")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .execute()
    )
    gastos_efectivo = sum(float(g["monto"]) for g in gastos.data if g.get("metodo_pago", "efectivo") == "efectivo")
    gastos_transferencia = sum(float(g["monto"]) for g in gastos.data if g.get("metodo_pago") == "transferencia")

    monto_inicial = float(caja.get("monto_inicial") or 0)
    sistema_efectivo = round(monto_inicial + ventas_efectivo - gastos_efectivo, 2)
    sistema_transferencia = round(ventas_transferencia - gastos_transferencia, 2)
    sistema_total = round(sistema_efectivo + sistema_transferencia, 2)

    return {
        "monto_sistema": sistema_total,
        "monto_sistema_efectivo": sistema_efectivo,
        "monto_sistema_transferencia": sistema_transferencia,
        "ventas_efectivo": round(ventas_efectivo, 2),
        "ventas_transferencia": round(ventas_transferencia, 2),
        "gastos_efectivo": round(gastos_efectivo, 2),
        "gastos_transferencia": round(gastos_transferencia, 2),
        "cantidad_ventas": cantidad_ventas,
    }


@router.post("/abrir")
def abrir_caja(data: AbrirCaja):
    existente = caja_abierta_actual()
    if existente:
        raise HTTPException(400, "Ya hay una caja abierta. Cerrala antes de abrir otra.")
    payload = {
        "fecha": data.fecha or fecha_hoy(),
        "monto_inicial": data.monto_inicial,
        "cerrada": False,
        "abierto_en": ahora_iso(),
        "nota_apertura": data.nota_apertura,
    }
    res = supabase.table("cierres_caja").insert(payload).execute()
    return res.data[0]


def _cerrar(caja: dict, data: CerrarCaja):
    montos = calcular_montos_sistema(caja)
    cambios = {
        "monto_contado": data.monto_contado,
        "monto_contado_efectivo": data.monto_contado_efectivo,
        "monto_contado_transferencia": data.monto_contado_transferencia,
        "monto_sistema": montos["monto_sistema"],
        "monto_sistema_efectivo": montos["monto_sistema_efectivo"],
        "monto_sistema_transferencia": montos["monto_sistema_transferencia"],
        "diferencia": round(data.monto_contado - montos["monto_sistema"], 2),
        "diferencia_efectivo": round(data.monto_contado_efectivo - montos["monto_sistema_efectivo"], 2),
        "diferencia_transferencia": round(data.monto_contado_transferencia - montos["monto_sistema_transferencia"], 2),
        "nota": data.nota,
        "cerrada": True,
        "cerrado_en": ahora_iso(),
    }
    res = supabase.table("cierres_caja").update(cambios).eq("id", caja["id"]).execute()
    return res.data[0]


@router.post("/cerrar")
def cerrar_caja_actual(data: CerrarCaja):
    caja = caja_abierta_actual()
    if not caja:
        raise HTTPException(404, "No hay una caja abierta para cerrar")
    return _cerrar(caja, data)


@router.post("/cerrar/{caja_id}")
def cerrar_caja_por_id(caja_id: str, data: CerrarCaja):
    res = supabase.table("cierres_caja").select("*").eq("id", caja_id).execute()
    if not res.data:
        raise HTTPException(404, "Caja no encontrada")
    caja = res.data[0]
    if caja.get("cerrada"):
        raise HTTPException(400, "Esta caja ya fue cerrada")
    return _cerrar(caja, data)


@router.get("/hoy")
def estado_caja_actual():
    abierta = caja_abierta_actual()
    if abierta:
        montos = calcular_montos_sistema(abierta)
        return {**abierta, "abierta": True, "monto_sistema_actual": montos["monto_sistema"], **montos}
    ultimo = (
        supabase.table("cierres_caja")
        .select("*")
        .order("abierto_en", desc=True)
        .limit(1)
        .execute()
    )
    return {"abierta": False, "ultimo_cierre": ultimo.data[0] if ultimo.data else None}


@router.get("/historial")
def historial_cierres(limite: int = 50):
    res = (
        supabase.table("cierres_caja")
        .select("*")
        .order("abierto_en", desc=True)
        .limit(limite)
        .execute()
    )
    return res.data
