-- Ejecutar en Supabase SQL Editor.
-- Mantiene las mismas tablas, agregando usuario_id para separar datos por cuenta.

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  password_hash text not null,
  rol text not null default 'jefe',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.usuarios (usuario, password_hash, rol)
values ('admin', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'jefe')
on conflict (usuario) do nothing;

insert into public.usuarios (usuario, password_hash, rol)
values ('demo', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'uni')
on conflict (usuario) do nothing;

do $$
declare
  admin_id uuid;
begin
  select id into admin_id from public.usuarios where usuario = 'admin';

  alter table public.ventas add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.gastos add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.cierres_caja add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.clientes add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.cuentas_corrientes add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.proveedores add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.productos_proveedor add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.historial_precios add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.proveedor_facturas add column if not exists usuario_id uuid references public.usuarios(id);
  alter table public.proveedor_pagos_factura add column if not exists usuario_id uuid references public.usuarios(id);

  update public.ventas set usuario_id = admin_id where usuario_id is null;
  update public.gastos set usuario_id = admin_id where usuario_id is null;
  update public.cierres_caja set usuario_id = admin_id where usuario_id is null;
  update public.clientes set usuario_id = admin_id where usuario_id is null;
  update public.cuentas_corrientes set usuario_id = admin_id where usuario_id is null;
  update public.proveedores set usuario_id = admin_id where usuario_id is null;
  update public.productos_proveedor set usuario_id = admin_id where usuario_id is null;
  update public.historial_precios set usuario_id = admin_id where usuario_id is null;
  update public.proveedor_facturas set usuario_id = admin_id where usuario_id is null;
  update public.proveedor_pagos_factura set usuario_id = admin_id where usuario_id is null;
end $$;

create index if not exists idx_ventas_usuario on public.ventas(usuario_id);
create index if not exists idx_gastos_usuario on public.gastos(usuario_id);
create index if not exists idx_cierres_usuario on public.cierres_caja(usuario_id);
create index if not exists idx_clientes_usuario on public.clientes(usuario_id);
create index if not exists idx_cuentas_usuario on public.cuentas_corrientes(usuario_id);
create index if not exists idx_proveedores_usuario on public.proveedores(usuario_id);
create index if not exists idx_productos_usuario on public.productos_proveedor(usuario_id);
create index if not exists idx_historial_usuario on public.historial_precios(usuario_id);
create index if not exists idx_facturas_usuario on public.proveedor_facturas(usuario_id);

drop view if exists public.resumen_ventas_diario;
drop view if exists public.saldo_clientes;
drop view if exists public.ultimo_precio_producto;
drop view if exists public.saldo_proveedores;

create view public.resumen_ventas_diario
with (security_invoker = true) as
select
  usuario_id,
  (fecha at time zone 'America/Argentina/Buenos_Aires')::date as dia,
  count(*) filter (where coalesce(anulada, false) = false)::int as cantidad_ventas,
  coalesce(sum(monto) filter (where coalesce(anulada, false) = false), 0)::numeric(12,2) as total,
  coalesce(sum(monto) filter (where coalesce(anulada, false) = false and metodo_pago = 'efectivo'), 0)::numeric(12,2) as total_efectivo,
  coalesce(sum(monto) filter (where coalesce(anulada, false) = false and metodo_pago = 'transferencia'), 0)::numeric(12,2) as total_transferencia
from public.ventas
group by usuario_id, (fecha at time zone 'America/Argentina/Buenos_Aires')::date;

create view public.saldo_clientes
with (security_invoker = true) as
select
  c.id,
  c.usuario_id,
  c.nombre,
  c.telefono,
  c.tipo,
  c.saldo_inicial,
  (
    coalesce(c.saldo_inicial, 0)
    + coalesce(sum(
      case
        when cc.tipo in ('deuda', 'compra', 'carga') then cc.monto
        when cc.tipo = 'pago' then -cc.monto
        else 0
      end
    ), 0)
  )::numeric(12,2) as saldo
from public.clientes c
left join public.cuentas_corrientes cc on cc.cliente_id = c.id and cc.usuario_id = c.usuario_id
group by c.id, c.usuario_id, c.nombre, c.telefono, c.tipo, c.saldo_inicial;

create view public.ultimo_precio_producto
with (security_invoker = true) as
select distinct on (p.id)
  p.id as producto_id,
  p.usuario_id,
  p.nombre as producto,
  pr.id as proveedor_id,
  pr.nombre as proveedor,
  h.precio_costo,
  h.precio_venta_sugerido,
  h.margen_porcentaje,
  h.fecha
from public.productos_proveedor p
join public.proveedores pr on pr.id = p.proveedor_id and pr.usuario_id = p.usuario_id
left join public.historial_precios h on h.producto_id = p.id and h.usuario_id = p.usuario_id
order by p.id, h.fecha desc;

create view public.saldo_proveedores
with (security_invoker = true) as
select
  p.id as proveedor_id,
  p.usuario_id,
  p.nombre as proveedor,
  coalesce(sum(greatest(f.monto_total - f.monto_pagado, 0)), 0)::numeric(12,2) as saldo_deuda,
  count(f.id) filter (where f.monto_total > f.monto_pagado)::int as facturas_pendientes
from public.proveedores p
left join public.proveedor_facturas f on f.proveedor_id = p.id and f.usuario_id = p.usuario_id
group by p.id, p.usuario_id, p.nombre;

grant select, insert, update, delete on public.usuarios to anon, authenticated;
