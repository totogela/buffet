from fastapi import APIRouter
from datetime import date, timedelta
from database import supabase

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/resumen-semana")
def resumen_semana():
    hoy = date.today()
    semana_pasada = (hoy - timedelta(days=7)).isoformat()
    res = supabase.table("resumen_ventas_diario").select("*").gte("dia", semana_pasada).execute()
    return res.data

@router.get("/ganancias")
def ganancias(desde: str = None, hasta: str = None):
    if not desde:
        desde = (date.today() - timedelta(days=30)).isoformat()
    if not hasta:
        hasta = date.today().isoformat()
    res = supabase.rpc("ganancias_periodo", {"fecha_desde": desde, "fecha_hasta": hasta}).execute()
    return res.data[0] if res.data else {}

@router.get("/mejor-dia")
def mejor_dia_semana():
    res = supabase.table("resumen_ventas_diario").select("dia, total").limit(90).execute()
    dias_semana = {0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves", 4: "Viernes", 5: "Sábado", 6: "Domingo"}
    totales = {}
    conteos = {}
    for r in res.data:
        dia_num = date.fromisoformat(r["dia"]).weekday()
        nombre = dias_semana[dia_num]
        totales[nombre] = totales.get(nombre, 0) + (r["total"] or 0)
        conteos[nombre] = conteos.get(nombre, 0) + 1
    promedios = {d: round(totales[d] / conteos[d], 2) for d in totales}
    return sorted(promedios.items(), key=lambda x: x[1], reverse=True)

@router.get("/comparativa")
def comparativa_semanas():
    hoy = date.today()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_semana_pasada = inicio_semana - timedelta(days=7)

    esta = supabase.table("resumen_ventas_diario").select("total").gte("dia", inicio_semana.isoformat()).execute()
    pasada = supabase.table("resumen_ventas_diario").select("total").gte("dia", inicio_semana_pasada.isoformat()).lt("dia", inicio_semana.isoformat()).execute()

    total_esta = sum(r["total"] or 0 for r in esta.data)
    total_pasada = sum(r["total"] or 0 for r in pasada.data)
    diferencia = round(total_esta - total_pasada, 2)
    porcentaje = round((diferencia / total_pasada * 100), 1) if total_pasada > 0 else 0

    return {
        "semana_actual": total_esta,
        "semana_anterior": total_pasada,
        "diferencia": diferencia,
        "porcentaje_cambio": porcentaje
    }
