let cajaInput = '0';
let cajaMetodo = null;

function load_caja() {
  renderDisplay();
}

function calcPress(val) {
  if (val === 'C') {
    cajaInput = '0';
  } else if (val === '⌫') {
    cajaInput = cajaInput.length > 1 ? cajaInput.slice(0, -1) : '0';
  } else if (val === '.') {
    if (!cajaInput.includes('.')) cajaInput += '.';
  } else {
    if (cajaInput === '0') cajaInput = val;
    else cajaInput += val;
    // Max 8 dígitos enteros
    const partes = cajaInput.split('.');
    if (partes[0].length > 8) { cajaInput = cajaInput.slice(0,-1); return; }
  }
  renderDisplay();
}

function renderDisplay() {
  const el = document.getElementById('caja-numero');
  if (!el) return;
  const n = parseFloat(cajaInput) || 0;
  el.textContent = n.toLocaleString('es-AR', { minimumFractionDigits: cajaInput.includes('.') ? (cajaInput.split('.')[1]?.length || 0) : 0 });
}

function selectMetodo(metodo) {
  cajaMetodo = metodo;
  document.querySelectorAll('.metodo-btn').forEach(b => {
    b.classList.remove('selected');
    if (b.dataset.metodo === metodo) b.classList.add('selected');
  });
}

async function confirmarVenta() {
  const monto = parseFloat(cajaInput);
  if (!monto || monto <= 0) { toast('Ingresá un monto', 'error'); return; }
  if (!cajaMetodo) { toast('Seleccioná efectivo o transferencia', 'error'); return; }

  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const venta = await post('/ventas/', { monto, metodo_pago: cajaMetodo });
    
    // Feedback visual
    const display = document.querySelector('.monto-display');
    display.style.borderColor = cajaMetodo === 'efectivo' ? 'var(--green)' : 'var(--blue)';
    setTimeout(() => display.style.borderColor = '', 600);

    toast(`Venta de ${fmt(monto)} registrada ✓`, 'success');

    // Guardar para deshacer
    window._ultimaVenta = venta;
    document.getElementById('btn-deshacer').style.display = 'flex';
    document.getElementById('btn-deshacer-info').textContent = `Deshacer ${fmt(monto)} (${cajaMetodo})`;

    // Reset
    cajaInput = '0';
    cajaMetodo = null;
    document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('selected'));
    renderDisplay();

    // Actualizar contador del día
    cargarContadorDia();
  } catch(e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar venta';
  }
}

async function deshacerVenta() {
  if (!window._ultimaVenta) return;
  try {
    await del(`/ventas/${window._ultimaVenta.id}/anular`);
    toast('Venta anulada', 'info');
    window._ultimaVenta = null;
    document.getElementById('btn-deshacer').style.display = 'none';
    cargarContadorDia();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function cargarContadorDia() {
  try {
    const hoy = await get('/ventas/hoy');
    const el = document.getElementById('caja-total-dia');
    const cnt = document.getElementById('caja-contador');
    if (el) el.textContent = fmt(hoy.total || 0);
    if (cnt) cnt.textContent = `${hoy.cantidad_ventas || 0} venta${hoy.cantidad_ventas !== 1 ? 's' : ''} hoy`;
  } catch(e) {}
}

// Teclado físico
document.addEventListener('keydown', e => {
  const page = document.getElementById('page-caja');
  if (!page?.classList.contains('active')) return;
  if (e.key >= '0' && e.key <= '9') calcPress(e.key);
  else if (e.key === 'Backspace') calcPress('⌫');
  else if (e.key === 'Escape') calcPress('C');
  else if (e.key === 'Enter') confirmarVenta();
  else if (e.key === 'e' || e.key === 'E') selectMetodo('efectivo');
  else if (e.key === 't' || e.key === 'T') selectMetodo('transferencia');
});
