async function load_home() {
  const el = id => document.getElementById(id);

  // Resumen del día — usa datos de la caja abierta
  try {
    const caja = await get('/caja/hoy');
    if (caja.abierta) {
      const ganancia = (caja.ventas_efectivo || 0) + (caja.ventas_transferencia || 0) - (caja.gastos_efectivo || 0) - (caja.gastos_transferencia || 0);
      const gastos = (caja.gastos_efectivo || 0) + (caja.gastos_transferencia || 0);
      el('home-total').textContent = fmt(ganancia);
      el('home-efectivo').textContent = fmt((caja.ventas_efectivo || 0) - (caja.gastos_efectivo || 0));
      el('home-transferencia').textContent = fmt((caja.ventas_transferencia || 0) - (caja.gastos_transferencia || 0));
      el('home-ventas').textContent = `${caja.cantidad_ventas || 0} ventas · gastos ${fmt(gastos)}`;
    } else {
      // Sin caja abierta, intenta con ventas/hoy
      const hoy = await get('/ventas/hoy');
      const ganancia = hoy.ganancia_neta ?? 0;
      const gastos = hoy.total_gastos ?? 0;
      el('home-total').textContent = fmt(ganancia);
      el('home-efectivo').textContent = fmt(hoy.efectivo_neto ?? hoy.total_efectivo ?? 0);
      el('home-transferencia').textContent = fmt(hoy.total_transferencia ?? 0);
      el('home-ventas').textContent = `${hoy.cantidad_ventas || 0} ventas · gastos ${fmt(gastos)}`;
    }
  } catch(e) {
    console.error('Error cargando ventas:', e);
  }

  // Caja
  try {
    const caja = await get('/caja/hoy');
    const cajaBadge = el('home-caja-badge');
    const cajaBtn = el('home-caja-btn');
    if (!caja.abierta) {
      cajaBadge.className = 'badge badge-red';
      cajaBadge.textContent = 'CERRADA';
      cajaBtn.textContent = 'Abrir caja';
      cajaBtn.onclick = () => openModal('modal-abrir-caja');
    } else {
      cajaBadge.className = 'badge badge-green';
      cajaBadge.textContent = 'ABIERTA';
      cajaBtn.textContent = 'Cerrar caja';
      cajaBtn.onclick = () => navigate('caja_cierre');
    }
  } catch(e) {}

  // Alertas deudas
  try {
    const deuda = await get('/cuentas/total-deuda');
    const alertaEl = el('home-alerta-deuda');
    if (deuda.cantidad_deudores > 0) {
      alertaEl.style.display = 'flex';
      alertaEl.innerHTML = `<span>⚠</span><span>${deuda.cantidad_deudores} cliente${deuda.cantidad_deudores > 1 ? 's' : ''} con deuda — Total: ${fmt(deuda.total_deuda)}</span>`;
    } else {
      alertaEl.style.display = 'none';
    }
  } catch(e) {}

  // Alertas proveedores
  try {
    const alertas = await get('/proveedores/precios/alertas');
    const alertaProvEl = el('home-alerta-prov');
    if (alertas.length > 0) {
      alertaProvEl.style.display = 'flex';
      alertaProvEl.innerHTML = `<span>📈</span><span>${alertas.length} producto${alertas.length > 1 ? 's' : ''} subieron de precio</span>`;
    } else {
      alertaProvEl.style.display = 'none';
    }
  } catch(e) {}

  // Últimas ventas
  try {
    const ventas = await get('/ventas/recientes?limite=5');
    const lista = el('home-ultimas-ventas');
    if (ventas.length === 0) {
      lista.innerHTML = '<div class="empty"><div class="empty-icon">🛒</div>Sin ventas hoy</div>';
    } else {
      lista.innerHTML = ventas.map(v => `
        <div class="list-item">
          <div class="list-item-left">
            <span class="list-item-title">${fmtDate(v.fecha)}</span>
            <span class="list-item-sub"><span class="badge ${v.metodo_pago === 'efectivo' ? 'badge-green' : 'badge-blue'}">${v.metodo_pago}</span></span>
          </div>
          <div class="list-item-right" style="color:var(--accent)">${fmt(v.monto)}</div>
        </div>
      `).join('');
    }
  } catch(e) {}
}

// Modal abrir caja
async function abrirCaja() {
  const monto = parseFloat(document.getElementById('input-monto-inicial').value) || 0;
  try {
    await post('/caja/abrir', { monto_inicial: monto });
    closeModal('modal-abrir-caja');
    toast('Caja abierta', 'success');
    load_home();
  } catch(e) {
    toast(e.message, 'error');
  }
}
