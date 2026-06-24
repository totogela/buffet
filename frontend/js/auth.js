let _rol = null;

function getRol() { return _rol; }
function esJefe() { return _rol === 'jefe'; }
function esDemo() { return _rol === 'uni'; }

function mostrarLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('password-input').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('usuario-input').focus();
}

function ocultarLogin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-container').style.display = '';
}

async function intentarLogin() {
  const usuario = document.getElementById('usuario-input').value.trim();
  const password = document.getElementById('password-input').value;
  try {
    const res = await post('/auth/login', { usuario, password });
    localStorage.setItem('buffet_token', res.token);
    localStorage.setItem('buffet_usuario', res.usuario);
    localStorage.setItem('buffet_rol', res.rol);
    _rol = res.rol;
    window._API_URL_OVERRIDE = null;
    aplicarRol();
    ocultarLogin();
    navigate(esJefe() || esDemo() ? 'home' : 'caja');
  } catch (e) {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('password-input').value = '';
  }
}

function cerrarSesion() {
  _rol = null;
  window._API_URL_OVERRIDE = null;
  localStorage.removeItem('buffet_token');
  localStorage.removeItem('buffet_usuario');
  localStorage.removeItem('buffet_rol');
  mostrarLogin();
}

function aplicarRol() {
  const itemsJefeOnly = ['home', 'gastos', 'caja_cierre', 'proveedores', 'cuentas'];
  itemsJefeOnly.forEach(page => {
    document.querySelectorAll(`[data-page="${page}"]`).forEach(el => {
      el.style.display = (esJefe() || esDemo()) ? '' : 'none';
    });
  });

  const btnCerrar = document.getElementById('home-btn-cerrar-caja');
  if (btnCerrar) btnCerrar.style.display = (esJefe() || esDemo()) ? '' : 'none';

  const label = esJefe() ? 'Jefe' : esDemo() ? 'Universidad' : 'Empleado';
  const badge = document.getElementById('rol-badge');
  if (badge) {
    badge.textContent = label;
    badge.style.background = esJefe() ? 'rgba(37,99,235,0.3)' : esDemo() ? 'rgba(120,80,200,0.3)' : 'rgba(100,116,139,0.3)';
  }
  const badgeSidebar = document.getElementById('rol-badge-sidebar');
  if (badgeSidebar) badgeSidebar.textContent = label;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') intentarLogin();
  });
  document.getElementById('usuario-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('password-input').focus();
  });

  const token = localStorage.getItem('buffet_token');
  const rol = localStorage.getItem('buffet_rol');
  if (token && rol) {
    _rol = rol;
    aplicarRol();
    ocultarLogin();
    navigate(esJefe() || esDemo() ? 'home' : 'caja');
  } else {
    mostrarLogin();
  }
});
