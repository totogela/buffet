// ─── PROVEEDORES ──────────────────────────────────────────────────────────────

async function load_proveedores() {
  await cargarProveedores();
}

async function guardarProveedor() {
  const nombre = document.getElementById('prov-nombre').value.trim();
  const telefono = document.getElementById('prov-telefono').value.trim();
  if (!nombre) { toast('Ingresá el nombre del proveedor', 'error'); return; }
  try {
    await post('/proveedores/', { nombre, telefono: telefono || null });
    toast('Proveedor agregado', 'success');
    document.getElementById('prov-nombre').value = '';
    document.getElementById('prov-telefono').value = '';
    closeModal('modal-proveedor');
    cargarProveedores();
  } catch(e) { toast(e.message, 'error'); }
}

async function cargarProveedores() {
  const lista = document.getElementById('lista-proveedores');
  lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const provs = await get('/proveedores/');
    if (provs.length === 0) {
      lista.innerHTML = '<div class="empty"><div class="empty-icon">🏪</div>Sin proveedores cargados</div>';
      return;
    }
    lista.innerHTML = provs.map(p => `
      <div class="list-item">
        <div class="list-item-left">
          <span class="list-item-title">${p.nombre}</span>
          <span class="list-item-sub">${p.telefono || 'Sin teléfono'} · Deuda: ${fmt(p.saldo_deuda || 0)}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="abrirDeudaProveedor('${p.id}','${p.nombre}')">Cargar deuda</button>
          <button class="btn btn-success" style="padding:6px 12px;font-size:12px" onclick="verFacturas('${p.id}','${p.nombre}')">Pagar</button>
          <button class="btn btn-danger" style="padding:6px 10px;font-size:11px" onclick="eliminarProveedor('${p.id}')">✕</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    lista.innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

async function eliminarProveedor(id) {
  if (!confirm('¿Eliminar proveedor y sus deudas?')) return;
  try {
    await del(`/proveedores/${id}`);
    toast('Proveedor eliminado', 'info');
    cargarProveedores();
  } catch(e) { toast(e.message, 'error'); }
}

function abrirDeudaProveedor(provId, provNombre) {
  window._proveedorDeuda = provId;
  document.getElementById('deuda-proveedor-title').textContent = `Deuda de ${provNombre}`;
  document.getElementById('deuda-proveedor-monto').value = '';
  document.getElementById('deuda-proveedor-descripcion').value = '';
  openModal('modal-deuda-proveedor');
}

async function guardarDeudaProveedor() {
  const monto = parseFloat(document.getElementById('deuda-proveedor-monto').value);
  const descripcion = document.getElementById('deuda-proveedor-descripcion').value.trim();
  if (!monto || monto <= 0) { toast('Ingresá cuánto le debés', 'error'); return; }
  try {
    await post('/proveedores/facturas', {
      proveedor_id: window._proveedorDeuda,
      descripcion: descripcion || 'Deuda cargada',
      monto_total: monto
    });
    toast('Deuda cargada', 'success');
    closeModal('modal-deuda-proveedor');
    cargarProveedores();
  } catch(e) { toast(e.message, 'error'); }
}

async function verFacturas(provId, provNombre) {
  window._proveedorFacturas = provId;
  document.getElementById('modal-facturas-title').textContent = `Deuda de ${provNombre}`;
  document.getElementById('factura-proveedor-nombre').textContent = provNombre;
  openModal('modal-facturas');
  await cargarFacturasProveedor();
}

async function cargarFacturasProveedor() {
  const lista = document.getElementById('lista-facturas-modal');
  lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const facturas = await get(`/proveedores/${window._proveedorFacturas}/facturas`);
    // Ordenar por fecha ascendente (más vieja primero)
    facturas.sort((a, b) => {
      const fa = a.fecha_emision || a.created_at || a.fecha || '';
      const fb = b.fecha_emision || b.created_at || b.fecha || '';
      return fa.localeCompare(fb);
    });
    const pendientes = facturas.filter(f => Number(f.monto_total) > Number(f.monto_pagado || 0));
    if (!facturas.length) {
      lista.innerHTML = '<div class="empty">Sin deuda cargada</div>';
      return;
    }
    lista.innerHTML = facturas.map(f => {
      const saldo = Number(f.monto_total) - Number(f.monto_pagado || 0);
      const pagada = saldo <= 0;
      const fechaStr = f.fecha_emision || f.created_at || f.fecha || null;
      return `
        <div style="border-bottom:1px solid var(--border);padding:12px 0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div>
              <div style="font-weight:700;font-size:15px;color:${pagada ? 'var(--text-dim)' : 'var(--text)'}">${fmt(saldo)} pendiente</div>
              <div style="font-size:12px;color:var(--text-dim);margin-top:2px">Total ${fmt(f.monto_total)} · Pagado ${fmt(f.monto_pagado || 0)}</div>
              ${fechaStr ? `<div style="font-size:11px;color:var(--text-dim);margin-top:2px">📅 ${fmtDate(fechaStr)}</div>` : ''}
              ${f.descripcion ? `<div style="font-size:12px;color:var(--text-dim)">${f.descripcion}</div>` : ''}
            </div>
            ${pagada ? '<span class="badge badge-green">PAGADA</span>' : ''}
          </div>
          ${!pagada ? `
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
              <input
                class="input"
                type="number"
                id="pago-inline-${f.id}"
                placeholder="Cuánto pagás"
                value="${saldo}"
                inputmode="decimal"
                style="flex:1;padding:8px 12px;font-size:14px"
              >
              <button
                class="btn btn-success"
                style="padding:8px 14px;font-size:13px;white-space:nowrap"
                onclick="confirmarPagoInline('${f.id}', ${saldo})"
              >Pagar</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('') + `
      <div style="margin-top:10px;background:var(--bg3);border-radius:var(--radius-sm);padding:12px;display:flex;justify-content:space-between">
        <span>Saldo total</span>
        <strong style="color:var(--red)">${fmt(pendientes.reduce((acc, f) => acc + Number(f.monto_total) - Number(f.monto_pagado || 0), 0))}</strong>
      </div>
    `;
  } catch(e) { lista.innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
}

async function confirmarPagoInline(facturaId, saldoMax) {
  const input = document.getElementById(`pago-inline-${facturaId}`);
  const monto = parseFloat(input.value);
  if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'error'); input.focus(); return; }
  if (monto > saldoMax) { toast(`El monto no puede superar ${fmt(saldoMax)}`, 'error'); input.focus(); return; }
  try {
    await post(`/proveedores/facturas/${facturaId}/pagos`, { monto, nota: null });
    toast('Pago descontado', 'success');
    cargarFacturasProveedor();
    cargarProveedores();
  } catch(e) { toast(e.message, 'error'); }
}


// ─── CUENTAS CORRIENTES ───────────────────────────────────────────────────────

let _cuentasTipo = 'deuda'; // 'deuda' | 'favor'
let _clienteActual = null;
let _movTipo = null; // tipo de movimiento en curso

async function load_cuentas() {
  await cargarResumenCuentas();
  await cargarClientes();
}

function setCuentasTipo(tipo) {
  _cuentasTipo = tipo;
  document.querySelectorAll('.cuentas-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tipo === tipo)
  );
  cargarClientes();
}

async function cargarResumenCuentas() {
  try {
    const r = await get('/cuentas/resumen');
    const dEl = document.getElementById('cuentas-total-deuda');
    const fEl = document.getElementById('cuentas-total-favor');
    if (dEl) dEl.textContent = fmt(r.total_deuda);
    if (fEl) fEl.textContent = fmt(r.total_favor);
  } catch(e) {}
}

async function cargarClientes() {
  const lista = document.getElementById('lista-clientes');
  lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const todos = await get('/cuentas/');
    const filtrado = todos.filter(c => c.tipo === _cuentasTipo);

    if (!filtrado.length) {
      lista.innerHTML = `<div class="empty"><div class="empty-icon">${_cuentasTipo === 'favor' ? '💰' : '📋'}</div>Sin clientes en esta sección</div>`;
      return;
    }

    lista.innerHTML = filtrado.map(c => {
      const saldo = Number(c.saldo || 0);
      const esFavor = c.tipo === 'favor';
      const color = esFavor
        ? (saldo >= 0 ? 'var(--green)' : 'var(--red)')
        : (saldo > 0 ? 'var(--red)' : 'var(--green)');
      const label = esFavor
        ? (saldo >= 0 ? `${fmt(saldo)} a favor` : `${fmt(Math.abs(saldo))} en rojo`)
        : (saldo > 0 ? `${fmt(saldo)} debe` : 'Sin deuda');

      return `
        <div class="list-item" onclick="abrirDetalle('${c.id}')" style="cursor:pointer">
          <div class="list-item-left">
            <span class="list-item-title">${c.nombre}</span>
            <span class="list-item-sub">${c.telefono || ''} ${c.ultimo_movimiento ? '· Último mov: ' + fmtDateOnly(c.ultimo_movimiento) : ''}</span>
          </div>
          <div style="font-family:var(--font-display);font-weight:700;color:${color};text-align:right;font-size:14px">${label}</div>
        </div>
      `;
    }).join('');
  } catch(e) {
    lista.innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

// ── Modal nuevo cliente ──
function toggleSaldoInicial() {
  const tipo = document.getElementById('cliente-tipo').value;
  document.getElementById('campo-saldo-inicial').style.display = tipo === 'favor' ? 'block' : 'none';
}

async function guardarCliente() {
  const nombre = document.getElementById('cliente-nombre').value.trim();
  const telefono = document.getElementById('cliente-telefono').value.trim();
  const tipo = document.getElementById('cliente-tipo').value;
  const saldo_inicial = parseFloat(document.getElementById('cliente-saldo-inicial')?.value) || 0;
  if (!nombre) { toast('Ingresá el nombre', 'error'); return; }
  try {
    await post('/cuentas/clientes', { nombre, telefono: telefono || null, tipo, saldo_inicial });
    toast('Cliente agregado', 'success');
    document.getElementById('cliente-nombre').value = '';
    document.getElementById('cliente-telefono').value = '';
    document.getElementById('cliente-tipo').value = 'deuda';
    document.getElementById('cliente-saldo-inicial').value = '';
    document.getElementById('campo-saldo-inicial').style.display = 'none';
    closeModal('modal-cliente');
    // Cambiar tab al tipo que se acaba de crear
    setCuentasTipo(tipo);
    cargarResumenCuentas();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Modal detalle/movimientos ──
async function abrirDetalle(clienteId) {
  // Buscar cliente en la lista cargada
  const todos = await get('/cuentas/').catch(() => []);
  const cliente = todos.find(c => c.id === clienteId);
  if (!cliente) return;
  _clienteActual = cliente;

  const saldo = Number(cliente.saldo || 0);
  const esFavor = cliente.tipo === 'favor';

  document.getElementById('detalle-cliente-nombre').textContent = cliente.nombre;

  const badgeEl = document.getElementById('detalle-saldo-badge');
  if (esFavor) {
    badgeEl.style.color = saldo >= 0 ? 'var(--green)' : 'var(--red)';
    badgeEl.textContent = saldo >= 0 ? `${fmt(saldo)} a favor` : `${fmt(Math.abs(saldo))} en rojo`;
  } else {
    badgeEl.style.color = saldo > 0 ? 'var(--red)' : 'var(--green)';
    badgeEl.textContent = saldo > 0 ? `${fmt(saldo)} debe` : 'Sin deuda';
  }

  // Botones de acción según tipo
  const accionesEl = document.getElementById('detalle-acciones');
  if (esFavor) {
    accionesEl.innerHTML = `
      <button class="btn btn-primary btn-full" onclick="abrirMovimiento('compra')">− Registrar compra</button>
      <button class="btn btn-ghost btn-full" onclick="abrirMovimiento('carga')">+ Cargar saldo</button>
    `;
  } else {
    accionesEl.innerHTML = `
      <button class="btn btn-primary btn-full" onclick="abrirMovimiento('deuda')">+ Registrar deuda</button>
      <button class="btn btn-success btn-full" onclick="abrirMovimiento('pago')">✓ Registrar pago</button>
    `;
  }

  openModal('modal-detalle-cliente');
  cargarMovimientosDetalle(clienteId);
}

async function cargarMovimientosDetalle(clienteId) {
  const el = document.getElementById('detalle-movimientos');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const movs = await get(`/cuentas/clientes/${clienteId}/movimientos`);
    if (!movs.length) { el.innerHTML = '<div class="empty">Sin movimientos</div>'; return; }
    const colorMap = { deuda: 'var(--red)', pago: 'var(--green)', compra: 'var(--red)', carga: 'var(--green)' };
    const signoMap = { deuda: '+', pago: '−', compra: '−', carga: '+' };
    const labelMap = { deuda: 'Deuda', pago: 'Pago', compra: 'Compra', carga: 'Carga' };
    el.innerHTML = movs.map(m => `
      <div class="list-item">
        <div class="list-item-left">
          <span class="list-item-title">${m.descripcion || labelMap[m.tipo] || m.tipo}</span>
          <span class="list-item-sub">${fmtDate(m.fecha)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--font-display);font-weight:700;color:${colorMap[m.tipo]}">${signoMap[m.tipo]}${fmt(m.monto)}</span>
          <button class="btn btn-danger" style="padding:4px 8px;font-size:10px" onclick="borrarMovimiento('${m.id}','${clienteId}')">✕</button>
        </div>
      </div>
    `).join('');
  } catch(e) { el.innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
}

async function borrarMovimiento(movId, clienteId) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  try {
    await del(`/cuentas/movimientos/${movId}`);
    toast('Movimiento eliminado', 'info');
    // Refrescar detalle y lista
    const todos = await get('/cuentas/').catch(() => []);
    _clienteActual = todos.find(c => c.id === clienteId) || _clienteActual;
    const saldo = Number(_clienteActual?.saldo || 0);
    const esFavor = _clienteActual?.tipo === 'favor';
    const badgeEl = document.getElementById('detalle-saldo-badge');
    if (badgeEl && _clienteActual) {
      if (esFavor) {
        badgeEl.style.color = saldo >= 0 ? 'var(--green)' : 'var(--red)';
        badgeEl.textContent = saldo >= 0 ? `${fmt(saldo)} a favor` : `${fmt(Math.abs(saldo))} en rojo`;
      } else {
        badgeEl.style.color = saldo > 0 ? 'var(--red)' : 'var(--green)';
        badgeEl.textContent = saldo > 0 ? `${fmt(saldo)} debe` : 'Sin deuda';
      }
    }
    cargarMovimientosDetalle(clienteId);
    cargarClientes();
    cargarResumenCuentas();
  } catch(e) { toast(e.message, 'error'); }
}

async function eliminarCliente() {
  if (!_clienteActual) return;
  if (!confirm(`¿Eliminar a ${_clienteActual.nombre} y todos sus movimientos?`)) return;
  try {
    await del(`/cuentas/clientes/${_clienteActual.id}`);
    toast('Cliente eliminado', 'info');
    closeModal('modal-detalle-cliente');
    _clienteActual = null;
    cargarClientes();
    cargarResumenCuentas();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Modal movimiento ──
function abrirMovimiento(tipo) {
  if (!_clienteActual) return;
  _movTipo = tipo;
  const titles = { deuda: 'Registrar deuda', pago: 'Registrar pago', compra: 'Registrar compra', carga: 'Cargar saldo' };
  const montoLabels = { deuda: 'Monto de la deuda', pago: 'Monto pagado', compra: 'Monto de la compra', carga: 'Monto a cargar' };
  const btnColors = { deuda: 'btn-primary', pago: 'btn-success', compra: 'btn-primary', carga: 'btn-success' };

  document.getElementById('mov-title').textContent = titles[tipo];
  document.getElementById('mov-cliente-nombre').textContent = _clienteActual.nombre;
  const saldo = Number(_clienteActual.saldo || 0);
  const esFavor = _clienteActual.tipo === 'favor';
  document.getElementById('mov-saldo-label').textContent = esFavor
    ? `Saldo actual: ${fmt(saldo)}`
    : (saldo > 0 ? `Deuda actual: ${fmt(saldo)}` : 'Sin deuda');
  document.getElementById('mov-monto-label').textContent = montoLabels[tipo];
  document.getElementById('mov-monto').value = '';
  document.getElementById('mov-descripcion').value = '';
  const btn = document.getElementById('mov-btn-confirmar');
  btn.className = `btn ${btnColors[tipo]}`;

  closeModal('modal-detalle-cliente');
  openModal('modal-movimiento');
}

async function confirmarMovimiento() {
  const monto = parseFloat(document.getElementById('mov-monto').value);
  const descripcion = document.getElementById('mov-descripcion').value.trim();
  if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }
  try {
    await post('/cuentas/movimientos', {
      cliente_id: _clienteActual.id,
      monto,
      tipo: _movTipo,
      descripcion: descripcion || null
    });
    const labels = { deuda: 'Deuda registrada', pago: 'Pago registrado', compra: 'Compra registrada', carga: 'Saldo cargado' };
    toast(labels[_movTipo] || 'Listo', 'success');
    closeModal('modal-movimiento');
    cargarClientes();
    cargarResumenCuentas();
  } catch(e) { toast(e.message, 'error'); }
}

// compat con funciones viejas por si quedan referencias
async function cargarClientesSelect() {}
async function registrarDeuda() {}
async function confirmarPago() {}
async function registrarPago() {}

// ─── CIERRE DE CAJA ───────────────────────────────────────────────────────────

async function load_caja_cierre() {
  try {
    const estado = await get('/caja/hoy');
    const secAbrir = document.getElementById('caja-abrir-sec');
    const secCerrar = document.getElementById('caja-cerrar-sec');
    const secEstado = document.getElementById('caja-estado-sec');

    if (!estado.abierta) {
      secAbrir.style.display = 'block';
      secCerrar.style.display = 'none';

      // Mostrar datos del último cierre al abrir
      const uc = estado.ultimo_cierre;
      const ucEl = document.getElementById('ultimo-cierre-info');
      if (uc) {
        ucEl.style.display = 'block';
        const sEf = uc.monto_sistema_efectivo ?? uc.monto_sistema ?? 0;
        const sTr = uc.monto_sistema_transferencia ?? 0;
        const dEf = uc.diferencia_efectivo ?? uc.diferencia ?? 0;
        document.getElementById('ultimo-sistema-efectivo').textContent = fmt(sEf);
        document.getElementById('ultimo-sistema-transferencia').textContent = fmt(sTr);
        const dEl = document.getElementById('ultimo-diferencia-efectivo');
        dEl.textContent = (dEf >= 0 ? '+' : '') + fmt(dEf);
        dEl.style.color = dEf === 0 ? 'var(--green)' : dEf > 0 ? 'var(--accent)' : 'var(--red)';
        // Sugerir el monto inicial = sistema efectivo del cierre anterior
        document.getElementById('abrir-monto').value = Math.max(0, sEf);
      } else {
        ucEl.style.display = 'none';
      }

      if (uc) {
        secEstado.style.display = 'block';
        mostrarResultadoCierre(uc, 'Último cierre');
      } else {
        secEstado.style.display = 'none';
      }
    } else {
      secAbrir.style.display = 'none';
      secCerrar.style.display = 'block';
      secEstado.style.display = 'none';
      document.getElementById('cierre-monto-inicial').textContent = fmt(estado.monto_inicial);
      document.getElementById('cierre-abierto-en').textContent = estado.abierto_en ? fmtDate(estado.abierto_en) : '—';

      // Desglose sistema
      document.getElementById('cierre-ventas-efectivo').textContent = fmt(estado.ventas_efectivo ?? 0);
      document.getElementById('cierre-ventas-transferencia').textContent = fmt(estado.ventas_transferencia ?? 0);
      document.getElementById('cierre-gastos-efectivo').textContent = fmt(estado.gastos_efectivo ?? 0);
      document.getElementById('cierre-gastos-transferencia').textContent = fmt(estado.gastos_transferencia ?? 0);
      document.getElementById('cierre-sistema-efectivo').textContent = fmt(estado.monto_sistema_efectivo ?? estado.monto_sistema_actual ?? 0);
      document.getElementById('cierre-sistema-transferencia').textContent = fmt(estado.monto_sistema_transferencia ?? 0);
    }
  } catch(e) { console.error(e); }

  // Historial
  try {
    const hist = await get('/caja/historial');
    const lista = document.getElementById('historial-cierres');
    if (!hist.length) { lista.innerHTML = '<div class="empty">Sin cierres anteriores</div>'; return; }
    lista.innerHTML = hist.filter(c => c.cerrada).map(c => `
      <div class="list-item">
        <div class="list-item-left">
          <span class="list-item-title">${fmtDate(c.cerrado_en || c.fecha)}</span>
          <span class="list-item-sub">Abrió ${c.abierto_en ? fmtDate(c.abierto_en) : fmtDateOnly(c.fecha)} · ${c.nota || ''}</span>
        </div>
        <div class="list-item-right">
          <span style="color:${(c.diferencia||0) >= 0 ? 'var(--green)' : 'var(--red)'}">${(c.diferencia||0) >= 0 ? '+' : ''}${fmt(c.diferencia||0)}</span>
        </div>
      </div>
    `).join('');
  } catch(e) {}
}

function mostrarResultadoCierre(cierre, titulo = 'Resultado') {
  document.getElementById('cierre-result-title').textContent = titulo;
  document.getElementById('cierre-result-contado').textContent = fmt(cierre.monto_contado);
  document.getElementById('cierre-result-sistema').textContent = fmt(cierre.monto_sistema);
  const dif = cierre.diferencia || 0;
  const difEl = document.getElementById('cierre-result-diferencia');
  difEl.textContent = (dif >= 0 ? '+' : '') + fmt(dif);
  difEl.style.color = dif === 0 ? 'var(--green)' : dif > 0 ? 'var(--accent)' : 'var(--red)';
  document.getElementById('cierre-result-nota').textContent = cierre.nota || '';
}

async function abrirCajaCierre() {
  const monto = parseFloat(document.getElementById('abrir-monto').value) || 0;
  try {
    await post('/caja/abrir', { monto_inicial: monto });
    toast('Caja abierta', 'success');
    load_caja_cierre();
  } catch(e) { toast(e.message, 'error'); }
}

async function cerrarCaja() {
  const efectivo = parseFloat(document.getElementById('cerrar-contado-efectivo').value) || 0;
  const transferencia = parseFloat(document.getElementById('cerrar-contado-transferencia').value) || 0;
  const nota = document.getElementById('cerrar-nota').value;
  try {
    await post('/caja/cerrar', {
      monto_contado: efectivo + transferencia,
      monto_contado_efectivo: efectivo,
      monto_contado_transferencia: transferencia,
      nota: nota || null
    });
    toast('Caja cerrada correctamente', 'success');
    document.getElementById('cerrar-contado-efectivo').value = '';
    document.getElementById('cerrar-contado-transferencia').value = '';
    document.getElementById('cerrar-nota').value = '';
    load_caja_cierre();
  } catch(e) { toast(e.message, 'error'); }
}

