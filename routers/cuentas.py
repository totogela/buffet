from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db_context import get_db
from auth import usuario_actual

router = APIRouter(prefix="/cuentas", tags=["Cuentas Corrientes"])


class ClienteCreate(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    tipo: str = "deuda"       # "deuda" | "favor"
    saldo_inicial: float = 0  # solo relevante para tipo "favor"


class MovimientoCreate(BaseModel):
    cliente_id: str
    monto: float
    tipo: str   # "deuda" | "pago" | "compra" | "carga"
    descripcion: Optional[str] = None


@router.get("/")
def listar_clientes(user: dict = Depends(usuario_actual)):
    res = get_db().table("saldo_clientes").select("*").eq("usuario_id", user["id"]).order("nombre").execute()
    return res.data


@router.get("/resumen")
def resumen_cuentas(user: dict = Depends(usuario_actual)):
    res = get_db().table("saldo_clientes").select("*").eq("usuario_id", user["id"]).execute()
    total_deuda = sum(r["saldo"] for r in res.data if r["tipo"] == "deuda" and r["saldo"] > 0)
    total_favor = sum(r["saldo"] for r in res.data if r["tipo"] == "favor" and r["saldo"] > 0)
    return {
        "total_deuda": round(total_deuda, 2),
        "total_favor": round(total_favor, 2),
        "deudores": len([r for r in res.data if r["tipo"] == "deuda" and r["saldo"] > 0]),
    }


@router.post("/clientes")
def crear_cliente(data: ClienteCreate, user: dict = Depends(usuario_actual)):
    if data.tipo not in ["deuda", "favor"]:
        raise HTTPException(400, "tipo debe ser 'deuda' o 'favor'")
    payload = {
        "nombre": data.nombre,
        "tipo": data.tipo,
        "saldo_inicial": data.saldo_inicial if data.tipo == "favor" else 0,
        "usuario_id": user["id"],
    }
    if data.telefono:
        payload["telefono"] = data.telefono
    res = get_db().table("clientes").insert(payload).execute()
    return res.data[0]


@router.delete("/clientes/{cliente_id}")
def eliminar_cliente(cliente_id: str, user: dict = Depends(usuario_actual)):
    get_db().table("cuentas_corrientes").delete().eq("cliente_id", cliente_id).eq("usuario_id", user["id"]).execute()
    res = get_db().table("clientes").delete().eq("id", cliente_id).eq("usuario_id", user["id"]).execute()
    if not res.data:
        raise HTTPException(404, "Cliente no encontrado")
    return {"ok": True}


@router.get("/clientes/{cliente_id}/movimientos")
def movimientos_cliente(cliente_id: str, user: dict = Depends(usuario_actual)):
    res = get_db().table("cuentas_corrientes").select("*").eq("cliente_id", cliente_id).eq("usuario_id", user["id"]).order("fecha", desc=True).execute()
    return res.data


@router.post("/movimientos")
def registrar_movimiento(data: MovimientoCreate, user: dict = Depends(usuario_actual)):
    tipos_validos = ["deuda", "pago", "compra", "carga"]
    if data.tipo not in tipos_validos:
        raise HTTPException(400, f"tipo debe ser uno de: {tipos_validos}")
    if data.monto <= 0:
        raise HTTPException(400, "El monto debe ser positivo")
    payload = {
        "cliente_id": data.cliente_id,
        "monto": data.monto,
        "tipo": data.tipo,
        "usuario_id": user["id"],
    }
    if data.descripcion:
        payload["descripcion"] = data.descripcion
    res = get_db().table("cuentas_corrientes").insert(payload).execute()
    return res.data[0]


@router.delete("/movimientos/{mov_id}")
def eliminar_movimiento(mov_id: str, user: dict = Depends(usuario_actual)):
    res = get_db().table("cuentas_corrientes").delete().eq("id", mov_id).eq("usuario_id", user["id"]).execute()
    if not res.data:
        raise HTTPException(404, "Movimiento no encontrado")
    return {"ok": True}


# Compat con frontend viejo
@router.get("/deudores")
def clientes_con_deuda(user: dict = Depends(usuario_actual)):
    res = get_db().table("saldo_clientes").select("*").eq("usuario_id", user["id"]).execute()
    return [r for r in res.data if r["tipo"] == "deuda" and r["saldo"] > 0]


@router.get("/total-deuda")
def total_deuda(user: dict = Depends(usuario_actual)):
    res = get_db().table("saldo_clientes").select("saldo", "tipo").eq("usuario_id", user["id"]).execute()
    deudores = [r for r in res.data if r["tipo"] == "deuda" and r["saldo"] > 0]
    return {
        "total_deuda": sum(r["saldo"] for r in deudores),
        "cantidad_deudores": len(deudores)
    }
