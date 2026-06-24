let _metodoGasto = 'efectivo';
let _gastosPeriodo = 'dia';

function selectMetodoGasto(metodo) {
  _metodoGasto = metodo;
  document.querySelectorAll('.metodo-gasto-btn').forEach(b => {
    const isEf = b.dataset.metodo === 'efectivo';
    const isSelected = b.dataset.metodo === metodo;
    b.style.borderColor = isSelected ? (isEf ? 'var(--green)' : 'var(--blue)') : 'var(--border)';
    b.style.color = isSelected ? (isEf ? 'var(--green)' : 'var(--blue)') : '';
    b.style.fontWeight = isSelected ? '700' : '';
  });
}


let _pieChart = null;

const CAT_COLORS = [
  '#e8571e','#f5a623','#4a90d9','#7ed321','#9b59b6',
  '#1abc9c','#e74c3c','#3498db','#f39c12','#2ecc71'
];

async function load_gastos() {
  await Promise.all([cargarCategorias(), cargarGastos()]);
}

function setGastosPeriodo(periodo) {
  _gastosPeriodo = periodo;
  document.querySelectorAll('.gastos-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.periodo === periodo);
  });
  cargarGastos();
}

function diasDelPeriodo(p) { return p === 'dia' ? 1 : p === 'semana' ? 7 : 30; }
function labelPeriodo(p)   { return p === 'dia' ? 'hoy' : p === 'semana' ? 'últimos 7 días' : 'últimos 30 días'; }

async function cargarCategorias() {
  try {
    const cats = await get('/gastos/categorias');
    const sel = document.getElementById('gasto-categoria');
    if (!sel) return;
    sel.innerHTML = '<option value="">Sin categoría</option>' +
      cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  } catch(e) {}
}

async function cargarGastos() {
  const lista  = document.getElementById('lista-gastos');
  const totalEl = document.getElementById('gastos-total');
  const labelEl = document.getElementById('gastos-periodo-label');
  lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const dias = diasDelPeriodo(_gastosPeriodo);
  if (labelEl) labelEl.textContent = `Total gastos (${labelPeriodo(_gastosPeriodo)})`;

  try {
    const gastos = await get(`/gastos/?dias=${dias}`);

    if (!gastos.length) {
      lista.innerHTML = '<div class="empty"><div class="empty-icon">💸</div>Sin gastos en este período</div>';
      if (totalEl) totalEl.textContent = fmt(0);
      dibujarPie([]);
      return;
    }

    const total = gastos.reduce((s, g) => s + g.monto, 0);
    if (totalEl) totalEl.textContent = fmt(total);

    // Pie por categoría
    const byCat = {};
    gastos.forEach(g => {
      const nombre = g.categorias_gasto?.nombre || 'Sin categoría';
      byCat[nombre] = (byCat[nombre] || 0) + g.monto;
    });
    dibujarPie(byCat);

    // Lista agrupada por día (siempre, para mostrar la fecha)
    const byDay = {};
    gastos.forEach(g => {
      const dia = (g.fecha || '').substring(0, 10);
      if (!byDay[dia]) byDay[dia] = [];
      byDay[dia].push(g);
    });
    const dias_keys = Object.keys(byDay).sort().reverse();

    lista.innerHTML = dias_keys.map(dia => {
      const items = byDay[dia];
      const subtotal = items.reduce((s, g) => s + g.monto, 0);
      return `
        <div style="margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid var(--border)">
            <span style="font-size:12px;font-weight:600;color:var(--text-dim)">${fmtDateOnly(dia)}</span>
            <span style="font-size:12px;font-weight:700;color:var(--red)">${fmt(subtotal)}</span>
          </div>
          ${items.map(g => renderGastoItem(g)).join('')}
        </div>
      `;
    }).join('');

  } catch(e) {
    lista.innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

function dibujarPie(byCat) {
  const canvas = document.getElementById('gastos-pie-canvas');
  const legend = document.getElementById('gastos-pie-legend');
  const card   = document.getElementById('gastos-chart-card');
  if (!canvas) return;

  const entries = Object.entries(byCat).sort((a,b) => b[1] - a[1]);

  if (!entries.length) {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = 'block';

  const total = entries.reduce((s, [,v]) => s + v, 0);
  const ctx = canvas.getContext('2d');
  const cx = 70, cy = 70, r = 62, ri = 30;
  ctx.clearRect(0, 0, 140, 140);

  let startAngle = -Math.PI / 2;
  entries.forEach(([cat, val], i) => {
    const slice = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = CAT_COLORS[i % CAT_COLORS.length];
    ctx.fill();

    // inner hole
    ctx.beginPath();
    ctx.arc(cx, cy, ri, 0, 2 * Math.PI);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#fff';
    ctx.fill();

    startAngle += slice;
  });

  // Legend
  legend.innerHTML = entries.map(([cat, val], i) => `
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:12px;height:12px;border-radius:3px;background:${CAT_COLORS[i % CAT_COLORS.length]};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cat}</div>
        <div style="font-size:11px;color:var(--text-dim)">${fmt(val)} · ${Math.round(val/total*100)}%</div>
      </div>
    </div>
  `).join('');
}

function renderGastoItem(g) {
  const metodoBadge = g.metodo_pago === 'transferencia'
    ? '<span class="badge badge-blue">transferencia</span>'
    : '<span class="badge badge-green">efectivo</span>';
  return `
    <div class="list-item">
      <div class="list-item-left">
        <span class="list-item-title">${g.descripcion || 'Sin descripción'}</span>
        <span class="list-item-sub">
          <span class="badge badge-orange">${g.categorias_gasto?.nombre || 'Otro'}</span>
          ${metodoBadge}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="list-item-right" style="color:var(--red)">${fmt(g.monto)}</div>
        <button class="btn btn-danger" style="padding:6px 10px;font-size:11px" onclick="eliminarGasto('${g.id}')">✕</button>
      </div>
    </div>
  `;
}

async function guardarGasto() {
  const monto = parseFloat(document.getElementById('gasto-monto').value);
  const descripcion = document.getElementById('gasto-descripcion').value;
  const categoria_id = document.getElementById('gasto-categoria').value;
  if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }
  try {
    await post('/gastos/', { monto, descripcion: descripcion || null, categoria_id: categoria_id || null, metodo_pago: _metodoGasto });
    toast('Gasto registrado', 'success');
    document.getElementById('gasto-monto').value = '';
    document.getElementById('gasto-descripcion').value = '';
    _metodoGasto = 'efectivo';
    selectMetodoGasto('efectivo');
    closeModal('modal-gasto');
    cargarGastos();
  } catch(e) { toast(e.message, 'error'); }
}

async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  try {
    await del(`/gastos/${id}`);
    toast('Gasto eliminado', 'info');
    cargarGastos();
  } catch(e) { toast(e.message, 'error'); }
}
