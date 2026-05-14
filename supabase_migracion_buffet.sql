-- Ejecutar en Supabase SQL Editor sobre la base "buffet".
-- Agrega cierres de caja por sesión y deudas/pagos de proveedores.

alter table if exists public.cierres_caja
  add column if not exists abierto_en timestamptz default now(),
  add column if not exists cerrado_en timestamptz,
  add column if not exists nota_apertura text;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.cierres_caja'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%fecha%'
  loop
    execute format('alter table public.cierres_caja drop constraint %I', r.conname);
  end loop;
end $$;

create index if not exists idx_cierres_caja_abierto_en
  on public.cierres_caja (abierto_en desc);

create index if not exists idx_cierres_caja_cerrada
  on public.cierres_caja (cerrada);

create table if not exists public.proveedor_facturas (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  numero text,
  descripcion text,
  monto_total numeric(12,2) not null check (monto_total >= 0),
  monto_pagado numeric(12,2) not null default 0 check (monto_pagado >= 0),
  estado text not null default 'pendiente',
  fecha_emision date not null default current_date,
  vencimiento date,
  created_at timestamptz not null default now()
);

create table if not exists public.proveedor_pagos_factura (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.proveedor_facturas(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  nota text,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_proveedor_facturas_proveedor
  on public.proveedor_facturas (proveedor_id, fecha_emision desc);

create index if not exists idx_proveedor_pagos_factura
  on public.proveedor_pagos_factura (factura_id, fecha desc);

create or replace view public.saldo_proveedores as
select
  p.id as proveedor_id,
  p.nombre as proveedor,
  coalesce(sum(greatest(f.monto_total - f.monto_pagado, 0)), 0)::numeric(12,2) as saldo_deuda,
  count(f.id) filter (where f.monto_total > f.monto_pagado)::int as facturas_pendientes
from public.proveedores p
left join public.proveedor_facturas f on f.proveedor_id = p.id
group by p.id, p.nombre;

grant select, insert, update, delete on public.proveedor_facturas to anon, authenticated;
grant select, insert, update, delete on public.proveedor_pagos_factura to anon, authenticated;
grant select on public.saldo_proveedores to anon, authenticated;
