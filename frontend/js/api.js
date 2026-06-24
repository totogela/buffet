const API_URL = 'https://buffet-production-df28.up.railway.app';

async function api(method, path, body = null) {
  const baseUrl = window._API_URL_OVERRIDE || API_URL;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = localStorage.getItem('buffet_token');
  if (token) opts.headers['X-Session-Token'] = token;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(baseUrl + path, opts);
    if (res.status === 401) {
      localStorage.removeItem('buffet_token');
      if (typeof mostrarLogin === 'function') mostrarLogin();
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Error ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    if (e.name === 'TypeError') throw new Error('Sin conexión con el servidor');
    throw e;
  }
}

const get  = (path)        => api('GET',    path);
const post = (path, body)  => api('POST',   path, body);
const del  = (path)        => api('DELETE', path);

// TOAST
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  const icons = { success: '✓', error: '✗', info: '●' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// FORMAT MONEY
function fmt(n) {
  if (n === null || n === undefined) return '$0';
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' +
         d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateOnly(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// MODAL
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// NAVEGACIÓN
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelectorAll('.nav-item, .sidebar-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  if (typeof window['load_' + page] === 'function') window['load_' + page]();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });
  // navegación inicial la maneja auth.js después del login
});
