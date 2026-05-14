# Buffet Escolar — Backend

API REST construida con FastAPI + Supabase.

## Setup local

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

La API corre en: http://localhost:8000
Documentación automática: http://localhost:8000/docs

## Variables de entorno (.env)

```
SUPABASE_URL=https://trxquxnjwhdsjxmcxiib.supabase.co
SUPABASE_KEY=tu_anon_key
SECRET_KEY=tu_secret_key
```

## Deploy en Railway

1. Crear cuenta en railway.app
2. New Project → Deploy from GitHub repo
3. Agregar las variables de entorno en Railway
4. Railway detecta el Procfile automáticamente

## Endpoints principales

### Ventas
- POST   /ventas/           → registrar venta
- DELETE /ventas/{id}/anular → anular venta
- GET    /ventas/hoy        → resumen del día
- GET    /ventas/resumen    → últimos N días
- GET    /ventas/recientes  → últimas 20 ventas

### Gastos
- POST   /gastos/           → registrar gasto
- GET    /gastos/           → listar gastos
- GET    /gastos/categorias → listar categorías
- DELETE /gastos/{id}       → eliminar gasto

### Caja
- POST   /caja/abrir        → abrir una caja/sesión
- POST   /caja/cerrar       → cerrar la caja abierta actual
- POST   /caja/cerrar/{id}  → cerrar una caja por id
- GET    /caja/hoy          → estado de la caja abierta o último cierre
- GET    /caja/historial    → historial de cierres por hora

### Proveedores
- GET    /proveedores/                    → listar proveedores
- POST   /proveedores/                    → crear proveedor
- GET    /proveedores/{id}/productos      → productos del proveedor
- POST   /proveedores/productos           → crear producto
- POST   /proveedores/precios             → registrar precio
- POST   /proveedores/boletas             → cargar productos desde boleta
- GET    /proveedores/{id}/facturas       → facturas/deuda del proveedor
- POST   /proveedores/facturas            → crear factura adeudada
- POST   /proveedores/facturas/{id}/pagos → descontar pago de factura
- GET    /proveedores/precios/alertas     → alertas de subida de precios
- GET    /proveedores/calculadora?costo=X&margen=Y → calcular precio de venta

### Cuentas Corrientes
- GET    /cuentas/                    → listar todos los clientes
- GET    /cuentas/deudores            → solo clientes con deuda
- POST   /cuentas/clientes            → crear cliente
- GET    /cuentas/clientes/{id}       → detalle + movimientos
- POST   /cuentas/movimientos         → registrar deuda o pago
- GET    /cuentas/total-deuda         → total general adeudado

### Analytics
- GET    /analytics/resumen-semana    → ventas últimos 7 días
- GET    /analytics/ganancias         → ventas - gastos en período
- GET    /analytics/mejor-dia        → ranking días de la semana
- GET    /analytics/comparativa       → esta semana vs semana pasada
