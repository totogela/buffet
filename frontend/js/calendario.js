let _calFecha = new Date();
let _calDatos = {};
let _calDiaSeleccionado = null;

async function load_calendario() {
  await cargarMes();
}

async function cargarMes() {
  const year = _calFecha.getFullYear();
  const month = _calFecha.getMonth() + 1;
  try {
    _calDatos = await get(`/ventas/mes/${year}/${month}`);
  } catch(e) { _calDatos = {}; }
  renderCalendario();
}

function renderCalendario() {
  const hoy = new Date();
  const year = _calFecha.getFullYear();
  const month = _calFecha.getMonth();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dias = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];

  document.getElementById('cal-titulo').textContent = `${meses[month]} ${year}`;

  // primer día en formato lunes=0
  let primerDia = new Date(year, month, 1).getDay();
  primerDia = primerDia === 0 ? 6 : primerDia - 1;
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  dias.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-header-day';
    h.textContent = d;
    grid.appendChild(h);
  });

  for (let i = 0; i < primerDia; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day cal-empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const datos = _calDatos[fechaStr];
    const esHoy = d === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();
    const esFuturo = new Date(year, month, d) > hoy;
    const esSeleccionado = _calDiaSeleccionado === fechaStr;

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (esHoy ? ' cal-hoy' : '') + (esFuturo ? ' cal-futuro' : '') + (esSeleccionado ? ' cal-seleccionado' : '');

    let html = `<div class="cal-num">${d}</div>`;
    if (datos && !esFuturo) {
      if (datos.ventas > 0) html += `<div class="cal-tag cal-tag-venta">+${fmtShort(datos.ventas)}</div>`;
      if (datos.gastos > 0) html += `<div class="cal-tag cal-tag-gasto">-${fmtShort(datos.gastos)}</div>`;
      const neto = datos.ventas - datos.gastos;
      if (datos.ventas > 0 || datos.gastos > 0) html += `<div class="cal-tag ${neto >= 0 ? 'cal-tag-neto-pos' : 'cal-tag-neto-neg'}">${neto >= 0 ? '+' : ''}${fmtShort(neto)}</div>`;
    }
    cell.innerHTML = html;
    if (!esFuturo) cell.onclick = () => seleccionarDia(fechaStr, cell);
    grid.appendChild(cell);
  }

  if (_calDiaSeleccionado) renderDetalle(_calDiaSeleccionado);
}

function fmtShort(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n/1000) + 'k';
  return '$' + Math.round(n);
}

async function calMesAnterior() {
  _calFecha.setMonth(_calFecha.getMonth() - 1);
  _calDiaSeleccionado = null;
  document.getElementById('cal-detalle').innerHTML = '';
  await cargarMes();
}

async function calMesSiguiente() {
  const hoy = new Date();
  const nueva = new Date(_calFecha.getFullYear(), _calFecha.getMonth() + 1, 1);
  if (nueva <= hoy) { _calFecha = nueva; _calDiaSeleccionado = null; await cargarMes(); }
}

function seleccionarDia(fecha, cell) {
  document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('cal-seleccionado'));
  cell.classList.add('cal-seleccionado');
  _calDiaSeleccionado = fecha;
  renderDetalle(fecha);
}

function renderDetalle(fecha) {
  const detalle = document.getElementById('cal-detalle');
  const datos = _calDatos[fecha];
  const [y, m, d] = fecha.split('-');
  const hoy = new Date();
  const esFuturo = new Date(parseInt(y), parseInt(m)-1, parseInt(d)) > hoy;
  const botonesEdicion = !esFuturo ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
      <button class="btn btn-success" style="font-size:12px;padding:8px" onclick="calMovAbrir('${fecha}','venta')">+ Venta</button>
      <button class="btn btn-danger" style="font-size:12px;padding:8px" onclick="calMovAbrir('${fecha}','gasto')">- Gasto</button>
    </div>` : '';

  if (!datos) {
    detalle.innerHTML = `<div class="card"><b>${d}/${m}/${y}</b><div class="empty" style="margin-top:8px">Sin movimientos</div>${botonesEdicion}</div>`;
    return;
  }
  const neto = datos.ventas - datos.gastos;
  const ventas = datos.items.filter(i => i.tipo === 'venta');
  const gastos = datos.items.filter(i => i.tipo === 'gasto');
  detalle.innerHTML = `
    <div class="card">
      <div style="font-weight:700;font-size:15px;margin-bottom:12px">${d}/${m}/${y}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:#dcfce7;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#166534;font-weight:700">VENTAS</div>
          <div style="font-weight:800;color:#16a34a;font-size:15px">${fmt(datos.ventas)}</div>
        </div>
        <div style="background:#fee2e2;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#991b1b;font-weight:700">GASTOS</div>
          <div style="font-weight:800;color:#dc2626;font-size:15px">${fmt(datos.gastos)}</div>
        </div>
        <div style="background:${neto>=0?'#dbeafe':'#fee2e2'};border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:10px;color:${neto>=0?'#1e40af':'#991b1b'};font-weight:700">NETO</div>
          <div style="font-weight:800;color:${neto>=0?'#2563eb':'#dc2626'};font-size:15px">${fmt(neto)}</div>
        </div>
      </div>
      ${ventas.length ? `<div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:6px">VENTAS (${ventas.length})</div>
      ${ventas.map(v=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)"><span class="badge ${v.metodo==='efectivo'?'badge-green':'badge-blue'}">${v.metodo||'efectivo'}</span><span style="font-weight:600;color:#16a34a">${fmt(v.monto)}</span></div>`).join('')}` : ''}
      ${gastos.length ? `<div style="font-size:11px;font-weight:700;color:#6b7280;margin:12px 0 6px">GASTOS (${gastos.length})</div>
      ${gastos.map(g=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px">${g.desc||'Sin descripción'}</span><span style="font-weight:600;color:#dc2626">${fmt(g.monto)}</span></div>`).join('')}` : ''}
      ${botonesEdicion}
    </div>`;
}

// ─── Modal movimiento en fecha pasada ────────────────────────────────────────

let _calMovFecha = null;
let _calMovTipo = 'venta';
let _calMovMetodo = 'efectivo';

function calMovAbrir(fecha, tipo) {
  _calMovFecha = fecha;
  const [y, m, d] = fecha.split('-');
  document.getElementById('cal-mov-title').textContent = `Agregar a ${d}/${m}/${y}`;
  document.getElementById('cal-mov-monto').value = '';
  document.getElementById('cal-mov-descripcion').value = '';
  calMovSetTipo(tipo);
  calMovSetMetodo('efectivo');
  openModal('modal-cal-movimiento');
}

function calMovSetTipo(tipo) {
  _calMovTipo = tipo;
  const btnVenta = document.getElementById('cal-mov-tab-venta');
  const btnGasto = document.getElementById('cal-mov-tab-gasto');
  const descField = document.getElementById('cal-mov-desc-field');
  if (tipo === 'venta') {
    btnVenta.className = 'btn btn-success';
    btnGasto.className = 'btn btn-ghost';
    btnGasto.style.border = '2px solid var(--border)';
    descField.style.display = 'none';
  } else {
    btnGasto.className = 'btn btn-danger';
    btnVenta.className = 'btn btn-ghost';
    btnVenta.style.border = '2px solid var(--border)';
    descField.style.display = '';
  }
}

function calMovSetMetodo(metodo) {
  _calMovMetodo = metodo;
  document.querySelectorAll('.cal-mov-metodo-btn').forEach(b => {
    const esEste = b.dataset.metodo === metodo;
    b.style.border = esEste ? (metodo === 'efectivo' ? '2px solid var(--green)' : '2px solid var(--blue)') : '2px solid var(--border)';
    b.style.color = esEste ? (metodo === 'efectivo' ? 'var(--green)' : 'var(--blue)') : '';
  });
}

async function calMovGuardar() {
  const monto = parseFloat(document.getElementById('cal-mov-monto').value);
  if (!monto || monto <= 0) { toast('Ingresá un monto', 'error'); return; }
  const btn = document.getElementById('cal-mov-guardar-btn');
  btn.disabled = true;
  btn.textContent = '...';
  try {
    if (_calMovTipo === 'venta') {
      await post('/ventas/', { monto, metodo_pago: _calMovMetodo, fecha: _calMovFecha });
    } else {
      const desc = document.getElementById('cal-mov-descripcion').value.trim();
      await post('/gastos/', { monto, metodo_pago: _calMovMetodo, descripcion: desc || undefined, fecha: _calMovFecha });
    }
    toast(`${_calMovTipo === 'venta' ? 'Venta' : 'Gasto'} registrado`, 'success');
    closeModal('modal-cal-movimiento');
    await cargarMes();
  } catch(e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}
