import re
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db_context import get_db

router = APIRouter(prefix="/proveedores", tags=["Proveedores"])


class ProveedorCreate(BaseModel):
    nombre: str
    telefono: Optional[str] = None


class ProductoCreate(BaseModel):
    nombre: str
    proveedor_id: str


class PrecioCreate(BaseModel):
    producto_id: str
    precio_costo: float
    margen_porcentaje: float


class FacturaProveedorCreate(BaseModel):
    proveedor_id: str
    numero: Optional[str] = None
    descripcion: Optional[str] = None
    monto_total: float
    fecha_emision: Optional[str] = None
    vencimiento: Optional[str] = None


class PagoFacturaCreate(BaseModel):
    monto: float
    nota: Optional[str] = None
    fecha: Optional[str] = None


class BoletaProducto(BaseModel):
    nombre: str
    precio_costo: float
    margen_porcentaje: Optional[float] = None
    cantidad: Optional[float] = 1


class BoletaCarga(BaseModel):
    proveedor_id: str
    texto: Optional[str] = None
    productos: Optional[List[BoletaProducto]] = None
    margen_porcentaje: float = 30
    numero_factura: Optional[str] = None
    registrar_factura: bool = False
    monto_factura: Optional[float] = None


def calcular_precio(costo: float, margen: float) -> float:
    return round(float(costo) * (1 + float(margen) / 100), 2)


def parsear_importe(valor: str) -> float:
    limpio = valor.strip().replace("$", "").replace(" ", "")
    if "," in limpio and "." in limpio:
        limpio = limpio.replace(".", "").replace(",", ".")
    elif "." in limpio and re.search(r"\.\d{3}($|\.)", limpio):
        limpio = limpio.replace(".", "")
    elif "," in limpio:
        limpio = limpio.replace(",", ".")
    return float(limpio)


def productos_desde_texto(texto: str, margen: float) -> List[BoletaProducto]:
    productos = []
    for linea in (texto or "").splitlines():
        linea = linea.strip()
        if not linea:
            continue
        match = re.search(r"(.+?)\s+\$?\s*([0-9][0-9.,]*)\s*$", linea)
        if not match:
            continue
        nombre = re.sub(r"\s+", " ", match.group(1)).strip(" -:")
        if len(nombre) < 2:
            continue
        productos.append(
            BoletaProducto(
                nombre=nombre,
                precio_costo=parsear_importe(match.group(2)),
                margen_porcentaje=margen,
            )
        )
    return productos


def obtener_o_crear_producto(proveedor_id: str, nombre: str) -> dict:
    existente = (
        get_db().table("productos_proveedor")
        .select("*")
        .eq("proveedor_id", proveedor_id)
        .ilike("nombre", nombre)
        .limit(1)
        .execute()
    )
    if existente.data:
        return existente.data[0]

    creado = (
        get_db().table("productos_proveedor")
        .insert({"proveedor_id": proveedor_id, "nombre": nombre})
        .execute()
    )
    return creado.data[0]


@router.get("/")
def listar_proveedores():
    proveedores = get_db().table("proveedores").select("*").order("nombre").execute()
    try:
        saldos = get_db().table("saldo_proveedores").select("*").execute()
        saldo_por_proveedor = {s["proveedor_id"]: s for s in saldos.data}
    except Exception:
        saldo_por_proveedor = {}
    return [
        {
            **p,
            "saldo_deuda": float(saldo_por_proveedor.get(p["id"], {}).get("saldo_deuda") or 0),
            "facturas_pendientes": int(saldo_por_proveedor.get(p["id"], {}).get("facturas_pendientes") or 0),
        }
        for p in proveedores.data
    ]


@router.post("/")
def crear_proveedor(data: ProveedorCreate):
    res = get_db().table("proveedores").insert(data.model_dump(exclude_none=True)).execute()
    return res.data[0]


@router.delete("/{proveedor_id}")
def eliminar_proveedor(proveedor_id: str):
    res = get_db().table("proveedores").delete().eq("id", proveedor_id).execute()
    if not res.data:
        raise HTTPException(404, "Proveedor no encontrado")
    return {"ok": True}


@router.get("/{proveedor_id}/productos")
def productos_proveedor(proveedor_id: str):
    res = get_db().table("ultimo_precio_producto").select("*").eq("proveedor_id", proveedor_id).execute()
    return res.data


@router.post("/productos")
def crear_producto(data: ProductoCreate):
    res = get_db().table("productos_proveedor").insert(data.model_dump()).execute()
    return res.data[0]


@router.post("/precios")
def registrar_precio(data: PrecioCreate):
    precio_venta = calcular_precio(data.precio_costo, data.margen_porcentaje)
    res = get_db().table("historial_precios").insert(
        {
            "producto_id": data.producto_id,
            "precio_costo": data.precio_costo,
            "precio_venta_sugerido": precio_venta,
            "margen_porcentaje": data.margen_porcentaje,
        }
    ).execute()
    return res.data[0]


@router.post("/boletas")
def cargar_boleta(data: BoletaCarga):
    productos = list(data.productos or [])
    if data.texto:
        productos.extend(productos_desde_texto(data.texto, data.margen_porcentaje))
    if not productos:
        raise HTTPException(400, "No se encontraron productos en la boleta")

    creados = []
    total = 0.0
    for item in productos:
        margen = item.margen_porcentaje if item.margen_porcentaje is not None else data.margen_porcentaje
        producto = obtener_o_crear_producto(data.proveedor_id, item.nombre)
        precio_costo = float(item.precio_costo)
        cantidad = float(item.cantidad or 1)
        total += precio_costo * cantidad
        precio = registrar_precio(
            PrecioCreate(
                producto_id=producto["id"],
                precio_costo=precio_costo,
                margen_porcentaje=margen,
            )
        )
        creados.append(
            {
                "producto_id": producto["id"],
                "nombre": item.nombre,
                "cantidad": cantidad,
                "precio_costo": precio_costo,
                "margen_porcentaje": margen,
                "precio_venta_sugerido": precio["precio_venta_sugerido"],
            }
        )

    factura = None
    if data.registrar_factura:
        factura = crear_factura(
            FacturaProveedorCreate(
                proveedor_id=data.proveedor_id,
                numero=data.numero_factura,
                descripcion="Carga desde boleta",
                monto_total=data.monto_factura or round(total, 2),
            )
        )

    return {"productos": creados, "total_costo": round(total, 2), "factura": factura}


@router.get("/precios/alertas")
def alertas_precios():
    productos = get_db().table("ultimo_precio_producto").select("producto_id, producto, proveedor, precio_costo").execute()
    alertas = []
    for p in productos.data:
        historial = (
            get_db().table("historial_precios")
            .select("precio_costo, fecha")
            .eq("producto_id", p["producto_id"])
            .order("fecha", desc=True)
            .limit(2)
            .execute()
        )
        if len(historial.data) >= 2:
            ultimo = historial.data[0]["precio_costo"]
            anterior = historial.data[1]["precio_costo"]
            if ultimo > anterior:
                alertas.append({**p, "precio_anterior": anterior, "precio_actual": ultimo, "diferencia": round(ultimo - anterior, 2)})
    return alertas


@router.get("/calculadora")
def calculadora_precio(costo: float, margen: float):
    precio_venta = calcular_precio(costo, margen)
    return {"costo": costo, "margen": margen, "precio_venta_sugerido": precio_venta}


@router.get("/{proveedor_id}/facturas")
def facturas_proveedor(proveedor_id: str):
    try:
        res = (
            get_db().table("proveedor_facturas")
            .select("*")
            .eq("proveedor_id", proveedor_id)
            .order("fecha_emision", desc=True)
            .execute()
        )
        return res.data
    except Exception:
        raise HTTPException(400, "Falta ejecutar la migración SQL de proveedores en Supabase")


@router.post("/facturas")
def crear_factura(data: FacturaProveedorCreate):
    try:
        res = (
            get_db().table("proveedor_facturas")
            .insert(
                {
                    **data.model_dump(exclude_none=True),
                    "fecha_emision": data.fecha_emision or date.today().isoformat(),
                    "monto_pagado": 0,
                    "estado": "pendiente",
                }
            )
            .execute()
        )
        return res.data[0]
    except Exception:
        raise HTTPException(400, "Falta ejecutar la migración SQL de proveedores en Supabase")


@router.post("/facturas/{factura_id}/pagos")
def registrar_pago_factura(factura_id: str, data: PagoFacturaCreate):
    try:
        factura_res = get_db().table("proveedor_facturas").select("*").eq("id", factura_id).execute()
        if not factura_res.data:
            raise HTTPException(404, "Factura no encontrada")

        factura = factura_res.data[0]
        pagado = float(factura.get("monto_pagado") or 0) + float(data.monto)
        total = float(factura.get("monto_total") or 0)
        estado = "pagada" if pagado >= total else "parcial"

        pago = (
            get_db().table("proveedor_pagos_factura")
            .insert(
                {
                    "factura_id": factura_id,
                    "monto": data.monto,
                    "nota": data.nota,
                    "fecha": data.fecha or date.today().isoformat(),
                }
            )
            .execute()
        )
        actualizada = (
            get_db().table("proveedor_facturas")
            .update({"monto_pagado": min(pagado, total), "estado": estado})
            .eq("id", factura_id)
            .execute()
        )
        return {"pago": pago.data[0], "factura": actualizada.data[0]}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Falta ejecutar la migración SQL de proveedores en Supabase")
