/* ============================================================================
   ADMIN DASHBOARD
   One owner = one store (v1). Everything here is scoped to STORE.id, which
   Row Level Security also enforces server-side — this file just has to be
   correct, it doesn't have to be the only thing keeping data safe.
============================================================================ */
const C = window.Catalog;

let STORE = null;
let categories = [];
let products = [];

const PANEL_TITLES = { resumen: 'Resumen', productos: 'Productos', categorias: 'Categorías', apariencia: 'Apariencia', tienda: 'Tienda' };
const STOCK_BADGE = { in_stock: ['Disponible', 'badge-ok'], out_of_stock: ['Agotado', 'badge-out'], preorder: ['Preventa', 'badge-pre'] };

/* ============================================================================
   BOOT
============================================================================ */
async function boot() {
  const { data: sessionData } = await window.db.auth.getSession();
  const session = sessionData && sessionData.session;
  if (!session) { location.href = 'login.html'; return; }

  const { data: store, error } = await window.db.from('stores').select('*').eq('owner_id', session.user.id).single();
  if (error || !store) {
    showBootError('Tu cuenta no está vinculada a ninguna tienda todavía. Contacta a quien te dio acceso a este panel.');
    return;
  }

  STORE = store;
  C.setLocale(STORE.locale || 'es');
  applyAccent(STORE.accent_color || '#63d2ff');

  document.getElementById('navAccountEmail').textContent = session.user.email || '';
  document.getElementById('accountEmailLine').textContent = 'Conectado como ' + (session.user.email || '');
  document.getElementById('navStoreName').textContent = STORE.name || 'Tu catálogo';
  document.getElementById('tpStoreName').textContent = (STORE.name || 'TU TIENDA').toUpperCase();
  if (STORE.logo_url) { const l = document.getElementById('navLogo'); l.src = STORE.logo_url; l.style.display = ''; }
  document.getElementById('viewCatalogLink').href = `../index.html?store=${encodeURIComponent(STORE.slug)}`;

  await Promise.all([loadCategories(), loadProducts()]);

  fillAppearanceForm(STORE);
  fillStoreForm(STORE);
  fillContactForm(STORE);
  populateCategorySelects();
  renderResumen();
  renderProducts();
  renderCategories();
  renderThemePreview();

  const hashPanel = location.hash.replace('#', '');
  showPanel(PANEL_TITLES[hashPanel] ? hashPanel : 'resumen');

  document.getElementById('bootState').hidden = true;
  document.getElementById('shell').hidden = false;
}

function showBootError(msg) {
  document.getElementById('bootState').innerHTML =
    `<div class="box"><div class="ic">⚠</div><h2>No pudimos abrir tu panel</h2><p>${msg}</p></div>`;
}

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full || '63d2ff', 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgba(hex, a) { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

function applyAccent(hex) {
  const root = document.documentElement.style;
  root.setProperty('--accent', hex);
  root.setProperty('--accent-soft', rgba(hex, 0.13));
  root.setProperty('--accent-glow', rgba(hex, 0.28));
}

async function loadCategories() {
  const { data, error } = await window.db.from('categories').select('*').eq('store_id', STORE.id).order('sort_order', { ascending: true });
  if (!error) categories = data || [];
}
async function loadProducts() {
  const { data, error } = await window.db.from('products').select('*').eq('store_id', STORE.id)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (!error) products = data || [];
}

document.addEventListener('DOMContentLoaded', boot);

/* ============================================================================
   TOAST
============================================================================ */
let _toastTimer;
function toast(msg, isError) {
  const el = document.getElementById('admToast');
  el.textContent = msg;
  el.className = isError ? 'show is-error' : 'show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

/* ============================================================================
   NAV / PANELS
============================================================================ */
function showPanel(key) {
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + key));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.panel === key));
  document.getElementById('topbarTitle').textContent = PANEL_TITLES[key] || key;
  history.replaceState(null, '', '#' + key);
  closeMobileNav();
}
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => showPanel(btn.dataset.panel)));

function openMobileNav() { document.getElementById('navEl').classList.add('is-open'); document.getElementById('navScrim').classList.add('is-open'); }
function closeMobileNav() { document.getElementById('navEl').classList.remove('is-open'); document.getElementById('navScrim').classList.remove('is-open'); }
document.getElementById('navToggle').addEventListener('click', openMobileNav);
document.getElementById('navScrim').addEventListener('click', closeMobileNav);

document.getElementById('btnLogout').addEventListener('click', async () => {
  await window.db.auth.signOut();
  location.href = 'login.html';
});

/* ============================================================================
   RESUMEN
============================================================================ */
function renderResumen() {
  document.getElementById('statTotal').textContent = products.length;
  document.getElementById('statVisible').textContent = products.filter(p => p.visible).length;
  document.getElementById('statOut').textContent = products.filter(p => p.stock_status === 'out_of_stock').length;
  document.getElementById('statCats').textContent = categories.length;
}
document.getElementById('qlNewProduct').addEventListener('click', () => { showPanel('productos'); openProductDrawer(null); });
document.getElementById('emptyNewProduct').addEventListener('click', () => openProductDrawer(null));
document.getElementById('btnNewProduct').addEventListener('click', () => openProductDrawer(null));
document.getElementById('qlAppearance').addEventListener('click', () => showPanel('apariencia'));
document.getElementById('qlShare').addEventListener('click', async () => {
  const url = document.getElementById('viewCatalogLink').href;
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
  catch (e) { toast(url); }
});

/* ============================================================================
   PRODUCTOS — list, search, quick toggles
============================================================================ */
function populateCategorySelects() {
  const opts = categories.map(c => `<option value="${c.id}">${C.escapeHtml(c.name)}</option>`).join('');
  document.getElementById('prodCatFilter').innerHTML = '<option value="">Todas las categorías</option>' + opts;
  document.getElementById('f_category').innerHTML = '<option value="">Sin categoría</option>' + opts;
}

function renderProducts() {
  const q = (document.getElementById('prodSearch').value || '').toLowerCase().trim();
  const catFilter = document.getElementById('prodCatFilter').value;
  const wrap = document.getElementById('productList');

  document.getElementById('productEmpty').hidden = products.length > 0;
  if (!products.length) { wrap.innerHTML = ''; return; }

  const list = products.filter(p => (!q || p.name.toLowerCase().includes(q)) && (!catFilter || p.category_id === catFilter));
  if (!list.length) { wrap.innerHTML = '<div class="empty-state"><p>No hay productos que coincidan con tu búsqueda.</p></div>'; return; }

  wrap.innerHTML = list.map(p => {
    const cat = categories.find(c => c.id === p.category_id);
    const [stockLabel, stockClass] = STOCK_BADGE[p.stock_status] || ['—', 'badge-hidden'];
    const meta = [cat ? cat.name : null, p.brand, p.sku].filter(Boolean).join(' · ') || '—';
    return `
      <div class="p-row" data-id="${p.id}">
        <img class="p-thumb" src="${p.image_url || ''}" alt="" onerror="this.style.visibility='hidden'">
        <div class="p-main">
          <div class="p-name">${C.escapeHtml(p.name)}</div>
          <div class="p-meta">${C.escapeHtml(meta)}</div>
        </div>
        <span class="badge ${stockClass}">${stockLabel}</span>
        <button type="button" class="star-btn ${p.featured ? 'is-on' : ''}" data-action="featured" title="Destacar en el banner">★</button>
        <div class="toggle ${p.visible ? 'is-on' : ''}" data-action="visible" title="Visible en el catálogo"></div>
        <div class="p-price">${C.formatMoney(p.price, STORE.currency)}</div>
        <div class="p-actions">
          <button type="button" class="btn btn-icon btn-ghost" data-action="edit" title="Editar">✎</button>
          <button type="button" class="btn btn-icon btn-ghost" data-action="delete" title="Eliminar">🗑</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('prodSearch').addEventListener('input', C.debounce(renderProducts, 200));
document.getElementById('prodCatFilter').addEventListener('change', renderProducts);

document.getElementById('productList').addEventListener('click', (e) => {
  const row = e.target.closest('.p-row'); if (!row) return;
  const product = products.find(p => p.id === row.dataset.id); if (!product) return;
  const actionEl = e.target.closest('[data-action]'); if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === 'edit') openProductDrawer(product);
  else if (action === 'delete') deleteProduct(product);
  else if (action === 'visible') toggleProductField(product, 'visible', !product.visible);
  else if (action === 'featured') toggleProductField(product, 'featured', !product.featured);
});

async function toggleProductField(product, field, value) {
  const { error } = await window.db.from('products').update({ [field]: value }).eq('id', product.id);
  if (error) { toast('No se pudo actualizar.', true); return; }
  product[field] = value;
  renderProducts(); renderResumen();
}

async function deleteProduct(product) {
  if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
  const { error } = await window.db.from('products').delete().eq('id', product.id);
  if (error) { toast('No se pudo eliminar el producto.', true); return; }
  if (product.image_path) removeStoreAsset(product.image_path);
  products = products.filter(p => p.id !== product.id);
  renderProducts(); renderResumen();
  toast('Producto eliminado');
}

/* ============================================================================
   PRODUCT DRAWER (add / edit)
============================================================================ */
let editingProductId = null;
let originalImagePath = null;
let currentImagePath = null;
let currentImageUrl = null;
let _gmcLoaded = false;

function openProductDrawer(product) {
  editingProductId = product ? product.id : null;
  document.getElementById('drawerTitle').textContent = product ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('btnDeleteProduct').style.display = product ? '' : 'none';
  const msg = document.getElementById('productMsg'); msg.textContent = ''; msg.className = 'form-msg';

  setVal('f_productId', product ? product.id : '');
  setVal('f_name', product ? product.name : '');
  setVal('f_description', product ? (product.description || '') : '');
  setVal('f_category', product ? (product.category_id || '') : '');
  setVal('f_brand', product ? (product.brand || '') : '');
  setVal('f_price', product ? product.price : '');
  setVal('f_compareAt', product && product.compare_at_price != null ? product.compare_at_price : '');
  setVal('f_sku', product ? (product.sku || '') : '');
  setVal('f_size', product ? (product.size || '') : '');
  setVal('f_color', product ? (product.color || '') : '');
  setVal('f_condition', product ? (product.condition || '') : '');
  setVal('f_stock', product ? product.stock_status : 'in_stock');
  setVal('f_badgeText', product ? (product.badge_text || '') : '');
  setVal('f_badgeColor', product && product.badge_color ? product.badge_color : '#f87171');
  setVal('f_sortOrder', product ? product.sort_order : 0);
  setVal('f_gmc', product ? (product.gmc_category || '') : '');
  document.getElementById('f_featured').checked = product ? !!product.featured : false;
  document.getElementById('f_visible').checked = product ? !!product.visible : true;

  originalImagePath = product ? (product.image_path || null) : null;
  currentImagePath = originalImagePath;
  currentImageUrl = product ? (product.image_url || null) : null;
  setPreview('imgPreview', 'imgDzText', 'imgRemoveBtn', currentImageUrl);

  ensureGmcOptionsLoaded();
  document.getElementById('drawerBackdrop').classList.add('is-open');
  document.getElementById('productDrawer').classList.add('is-open');
}

function setVal(id, value) { document.getElementById(id).value = value; }

function closeProductDrawer(discardUnsavedImage) {
  if (discardUnsavedImage && currentImagePath && currentImagePath !== originalImagePath) removeStoreAsset(currentImagePath);
  document.getElementById('drawerBackdrop').classList.remove('is-open');
  document.getElementById('productDrawer').classList.remove('is-open');
}
document.getElementById('drawerClose').addEventListener('click', () => closeProductDrawer(true));
document.getElementById('btnCancelProduct').addEventListener('click', () => closeProductDrawer(true));
document.getElementById('drawerBackdrop').addEventListener('click', () => closeProductDrawer(true));

async function ensureGmcOptionsLoaded() {
  if (_gmcLoaded) return;
  try {
    const res = await fetch('../shared/fb-categories.json');
    const rows = await res.json();
    document.getElementById('gmcOptions').innerHTML = rows.map(r => `<option value="${C.escapeHtml(r.path)}">`).join('');
    _gmcLoaded = true;
  } catch (e) { /* optional field — fine if this never loads */ }
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('productMsg');
  const btn = document.getElementById('btnSaveProduct');
  btn.disabled = true; btn.textContent = 'Guardando…';
  msg.textContent = ''; msg.className = 'form-msg';

  const payload = {
    store_id: STORE.id,
    name: document.getElementById('f_name').value.trim(),
    description: document.getElementById('f_description').value.trim() || null,
    category_id: document.getElementById('f_category').value || null,
    brand: document.getElementById('f_brand').value.trim() || null,
    price: parseFloat(document.getElementById('f_price').value || 0),
    compare_at_price: document.getElementById('f_compareAt').value ? parseFloat(document.getElementById('f_compareAt').value) : null,
    sku: document.getElementById('f_sku').value.trim() || null,
    size: document.getElementById('f_size').value.trim() || null,
    color: document.getElementById('f_color').value.trim() || null,
    condition: document.getElementById('f_condition').value.trim() || null,
    stock_status: document.getElementById('f_stock').value,
    badge_text: document.getElementById('f_badgeText').value.trim() || null,
    badge_color: document.getElementById('f_badgeColor').value || null,
    sort_order: parseInt(document.getElementById('f_sortOrder').value || 0, 10),
    gmc_category: document.getElementById('f_gmc').value.trim() || null,
    featured: document.getElementById('f_featured').checked,
    visible: document.getElementById('f_visible').checked,
    image_url: currentImageUrl,
    image_path: currentImagePath
  };

  const resp = editingProductId
    ? await window.db.from('products').update(payload).eq('id', editingProductId).select().single()
    : await window.db.from('products').insert(payload).select().single();

  btn.disabled = false; btn.textContent = 'Guardar producto';

  if (resp.error) {
    msg.textContent = 'No se pudo guardar. Revisa los campos e intenta de nuevo.';
    msg.className = 'form-msg is-error';
    return;
  }

  if (originalImagePath && originalImagePath !== currentImagePath) removeStoreAsset(originalImagePath);

  if (editingProductId) {
    const idx = products.findIndex(p => p.id === editingProductId);
    if (idx > -1) products[idx] = resp.data;
  } else {
    products.unshift(resp.data);
  }

  renderProducts(); renderResumen();
  closeProductDrawer(false);
  toast('Producto guardado');
});

document.getElementById('btnDeleteProduct').addEventListener('click', async () => {
  if (!editingProductId) return;
  const product = products.find(p => p.id === editingProductId);
  if (!product) return;
  closeProductDrawer(false);
  await deleteProduct(product);
});

/* Image dropzone for the product form */
wireDropzone({
  zone: document.getElementById('imgDropzone'),
  input: document.getElementById('imgInput'),
  removeBtn: document.getElementById('imgRemoveBtn'),
  onFile: async (file) => {
    const dz = document.getElementById('imgDzText');
    const prevText = dz.innerHTML;
    dz.textContent = 'Subiendo…';
    try {
      const blob = await compressImage(file, { maxDim: 1280, quality: 0.82, mime: 'image/jpeg' });
      const path = `${STORE.id}/products/${crypto.randomUUID()}.jpg`;
      const url = await uploadStoreAsset(path, blob);
      if (currentImagePath && currentImagePath !== originalImagePath) removeStoreAsset(currentImagePath);
      currentImagePath = path; currentImageUrl = url;
      setPreview('imgPreview', 'imgDzText', 'imgRemoveBtn', url);
    } catch (err) {
      toast('No se pudo subir la imagen.', true);
      dz.innerHTML = prevText;
    }
  },
  onRemove: () => {
    if (currentImagePath && currentImagePath !== originalImagePath) removeStoreAsset(currentImagePath);
    currentImagePath = null; currentImageUrl = null;
    setPreview('imgPreview', 'imgDzText', 'imgRemoveBtn', null);
  }
});

/* ============================================================================
   CATEGORÍAS
============================================================================ */
function renderCategories() {
  const wrap = document.getElementById('categoryList');
  if (!categories.length) {
    wrap.innerHTML = '<div class="empty-state"><p>Aún no tienes categorías. Agrega la primera abajo.</p></div>';
    return;
  }
  wrap.innerHTML = categories.map(c => {
    const count = products.filter(p => p.category_id === c.id).length;
    return `
      <div class="cat-row" data-id="${c.id}">
        <input class="cat-name" type="text" value="${C.escapeHtml(c.name)}" data-field="name">
        <span class="cat-count">${count} producto${count === 1 ? '' : 's'}</span>
        <input class="cat-order" type="number" value="${c.sort_order}" data-field="sort_order" title="Orden">
        <button type="button" class="btn btn-icon btn-ghost" data-action="delete" title="Eliminar">🗑</button>
      </div>`;
  }).join('');
}

document.getElementById('categoryList').addEventListener('change', async (e) => {
  const row = e.target.closest('.cat-row'); if (!row) return;
  const field = e.target.dataset.field; if (!field) return;
  const cat = categories.find(c => c.id === row.dataset.id); if (!cat) return;
  const value = field === 'sort_order' ? parseInt(e.target.value || 0, 10) : e.target.value.trim();
  if (field === 'name' && !value) { e.target.value = cat.name; return; }

  const { error } = await window.db.from('categories').update({ [field]: value }).eq('id', cat.id);
  if (error) { toast('No se pudo guardar la categoría.', true); return; }
  cat[field] = value;
  if (field === 'name') { populateCategorySelects(); renderProducts(); }
  toast('Categoría actualizada');
});

document.getElementById('categoryList').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-action="delete"]')) return;
  const row = e.target.closest('.cat-row'); if (!row) return;
  const cat = categories.find(c => c.id === row.dataset.id); if (!cat) return;
  const count = products.filter(p => p.category_id === cat.id).length;
  const warn = count ? ` ${count} producto${count === 1 ? '' : 's'} se quedará${count === 1 ? '' : 'n'} sin categoría.` : '';
  if (!confirm(`¿Eliminar la categoría "${cat.name}"?${warn}`)) return;

  const { error } = await window.db.from('categories').delete().eq('id', cat.id);
  if (error) { toast('No se pudo eliminar la categoría.', true); return; }
  categories = categories.filter(c => c.id !== cat.id);
  products.forEach(p => { if (p.category_id === cat.id) p.category_id = null; });
  populateCategorySelects(); renderCategories(); renderProducts(); renderResumen();
  toast('Categoría eliminada');
});

document.getElementById('btnAddCat').addEventListener('click', addCategory);
document.getElementById('newCatName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCategory(); });

async function addCategory() {
  const input = document.getElementById('newCatName');
  const name = input.value.trim();
  if (!name) return;
  const sort_order = categories.length ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;

  const { data, error } = await window.db.from('categories').insert({ store_id: STORE.id, name, sort_order }).select().single();
  if (error) { toast('No se pudo agregar la categoría.', true); return; }
  categories.push(data);
  input.value = '';
  populateCategorySelects(); renderCategories();
  toast('Categoría agregada');
}

/* ============================================================================
   APARIENCIA (theme)
============================================================================ */
function fillAppearanceForm(store) {
  setVal('themeMode', store.theme_mode || 'dark');
  setColorPair('accentColorPicker', 'accentColor', store.accent_color || '#63d2ff');
  setColorPair('bgColorPicker', 'bgColor', store.bg_color || '#1a1a1a');
  setColorPair('surfaceColorPicker', 'surfaceColor', store.surface_color || '#252525');
  setColorPair('textColorPicker', 'textColor', store.text_color || '#eef2f7');
  setVal('fontPreset', `${store.font_display || 'Outfit'}|${store.font_mono || 'DM Mono'}`);
  document.getElementById('bannerAutoplay').checked = store.banner_autoplay !== false;
  setPreview('logoPreview', 'logoDzText', 'logoRemoveBtn', store.logo_url || null);
  setPreview('faviconPreview', 'faviconDzText', 'faviconRemoveBtn', store.favicon_url || null);
}

function setColorPair(pickerId, textId, hex) { setVal(pickerId, hex); setVal(textId, hex); }

['accentColor', 'bgColor', 'surfaceColor', 'textColor'].forEach(id => {
  const text = document.getElementById(id);
  const picker = document.getElementById(id + 'Picker');
  picker.addEventListener('input', () => { text.value = picker.value; renderThemePreview(); });
  text.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value; renderThemePreview(); });
});
document.getElementById('fontPreset').addEventListener('change', renderThemePreview);
document.getElementById('themeMode').addEventListener('change', renderThemePreview);

const _loadedFonts = new Set();
function loadGoogleFont(family) {
  if (!family || _loadedFonts.has(family)) return;
  _loadedFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function renderThemePreview() {
  const accent = document.getElementById('accentColor').value || '#63d2ff';
  const bg = document.getElementById('bgColor').value || '#1a1a1a';
  const surface = document.getElementById('surfaceColor').value || '#252525';
  const text = document.getElementById('textColor').value || '#eef2f7';
  const [fontDisplay, fontMono] = document.getElementById('fontPreset').value.split('|');
  loadGoogleFont(fontDisplay); loadGoogleFont(fontMono);

  const el = document.getElementById('themePreview');
  el.style.setProperty('--tp-bg', bg);
  el.style.setProperty('--tp-surface', surface);
  el.style.setProperty('--tp-border', rgba(accent, 0.18));
  el.style.setProperty('--tp-accent', accent);
  el.style.setProperty('--tp-accent-soft', rgba(accent, 0.14));
  el.style.setProperty('--tp-text', text);
  el.style.setProperty('--tp-font', `'${fontDisplay}',sans-serif`);
  el.style.setProperty('--tp-font-mono', `'${fontMono}',monospace`);
  el.style.background = bg;
}

document.getElementById('btnSaveAppearance').addEventListener('click', async () => {
  const msg = document.getElementById('appearanceMsg');
  const btn = document.getElementById('btnSaveAppearance');
  btn.disabled = true; btn.textContent = 'Guardando…';
  msg.textContent = ''; msg.className = 'form-msg';

  const [fontDisplay, fontMono] = document.getElementById('fontPreset').value.split('|');
  const payload = {
    theme_mode: document.getElementById('themeMode').value,
    accent_color: document.getElementById('accentColor').value,
    bg_color: document.getElementById('bgColor').value,
    surface_color: document.getElementById('surfaceColor').value,
    text_color: document.getElementById('textColor').value,
    font_display: fontDisplay,
    font_mono: fontMono,
    banner_autoplay: document.getElementById('bannerAutoplay').checked
  };

  const { error } = await window.db.from('stores').update(payload).eq('id', STORE.id);
  btn.disabled = false; btn.textContent = 'Guardar apariencia';

  if (error) { msg.textContent = 'No se pudo guardar.'; msg.className = 'form-msg is-error'; return; }
  Object.assign(STORE, payload);
  applyAccent(STORE.accent_color);
  msg.textContent = 'Apariencia guardada.'; msg.className = 'form-msg is-ok';
  toast('Apariencia guardada');
});

wireDropzone({
  zone: document.getElementById('logoDropzone'),
  input: document.getElementById('logoInput'),
  removeBtn: document.getElementById('logoRemoveBtn'),
  onFile: (file) => handleBrandAsset(file, 'logo'),
  onRemove: () => removeBrandAsset('logo')
});
wireDropzone({
  zone: document.getElementById('faviconDropzone'),
  input: document.getElementById('faviconInput'),
  removeBtn: document.getElementById('faviconRemoveBtn'),
  onFile: (file) => handleBrandAsset(file, 'favicon'),
  onRemove: () => removeBrandAsset('favicon')
});

async function handleBrandAsset(file, kind) {
  const maxDim = kind === 'logo' ? 480 : 256;
  const column = kind === 'logo' ? 'logo_url' : 'favicon_url';
  try {
    const blob = await compressImage(file, { maxDim, mime: 'image/png' });
    const path = `${STORE.id}/${kind}.png`;
    const url = await uploadStoreAsset(path, blob);
    const versionedUrl = `${url}?v=${Date.now()}`;
    const { error } = await window.db.from('stores').update({ [column]: versionedUrl }).eq('id', STORE.id);
    if (error) throw error;
    STORE[column] = versionedUrl;
    setPreview(kind === 'logo' ? 'logoPreview' : 'faviconPreview', kind === 'logo' ? 'logoDzText' : 'faviconDzText', kind === 'logo' ? 'logoRemoveBtn' : 'faviconRemoveBtn', versionedUrl);
    if (kind === 'logo') { const l = document.getElementById('navLogo'); l.src = versionedUrl; l.style.display = ''; }
    toast(kind === 'logo' ? 'Logo actualizado' : 'Favicon actualizado');
  } catch (e) {
    toast('No se pudo subir la imagen.', true);
  }
}

async function removeBrandAsset(kind) {
  const column = kind === 'logo' ? 'logo_url' : 'favicon_url';
  const path = `${STORE.id}/${kind}.png`;
  const { error } = await window.db.from('stores').update({ [column]: null }).eq('id', STORE.id);
  if (error) { toast('No se pudo quitar la imagen.', true); return; }
  removeStoreAsset(path);
  STORE[column] = null;
  setPreview(kind === 'logo' ? 'logoPreview' : 'faviconPreview', kind === 'logo' ? 'logoDzText' : 'faviconDzText', kind === 'logo' ? 'logoRemoveBtn' : 'faviconRemoveBtn', null);
  if (kind === 'logo') document.getElementById('navLogo').style.display = 'none';
  toast(kind === 'logo' ? 'Logo eliminado' : 'Favicon eliminado');
}

/* ============================================================================
   TIENDA (store info + contact)
============================================================================ */
function fillStoreForm(store) {
  setVal('storeName', store.name || '');
  setVal('storeTagline', store.tagline || '');
  setVal('storeBizType', store.business_type || '');
  setVal('storeCurrency', store.currency || 'MXN');
  setVal('storeLocale', store.locale || 'es');
}

document.getElementById('btnSaveStore').addEventListener('click', async () => {
  const msg = document.getElementById('storeMsg');
  const btn = document.getElementById('btnSaveStore');
  btn.disabled = true; btn.textContent = 'Guardando…';
  msg.textContent = ''; msg.className = 'form-msg';

  const payload = {
    name: document.getElementById('storeName').value.trim(),
    tagline: document.getElementById('storeTagline').value.trim() || null,
    business_type: document.getElementById('storeBizType').value.trim() || null,
    currency: document.getElementById('storeCurrency').value.trim().toUpperCase() || 'MXN',
    locale: document.getElementById('storeLocale').value
  };

  const { error } = await window.db.from('stores').update(payload).eq('id', STORE.id);
  btn.disabled = false; btn.textContent = 'Guardar datos del negocio';

  if (error) { msg.textContent = 'No se pudo guardar.'; msg.className = 'form-msg is-error'; return; }
  Object.assign(STORE, payload);
  C.setLocale(STORE.locale);
  document.getElementById('navStoreName').textContent = STORE.name;
  document.getElementById('tpStoreName').textContent = STORE.name.toUpperCase();
  renderProducts();
  msg.textContent = 'Guardado.'; msg.className = 'form-msg is-ok';
  toast('Datos del negocio guardados');
});

const CONTACT_COPY = {
  whatsapp: { label: 'Número de WhatsApp', placeholder: '529991234567', hint: 'Incluye el código de país, sin espacios ni símbolos. Ej: 52 para México.' },
  email: { label: 'Correo electrónico', placeholder: 'tu@negocio.com', hint: 'A este correo llegarán las preguntas de tus clientes.' },
  phone: { label: 'Número de teléfono', placeholder: '+52 999 123 4567', hint: 'Se abrirá la app de llamadas del cliente.' },
  link: { label: 'Enlace (URL)', placeholder: 'https://...', hint: 'Por ejemplo, tu página de Facebook o Instagram.' }
};

function fillContactForm(store) {
  setVal('contactMethod', store.contact_method || 'whatsapp');
  setVal('contactValue', store.contact_value || '');
  setVal('contactMessage', store.contact_message || '');
  updateContactCopy();
}

function updateContactCopy() {
  const method = document.getElementById('contactMethod').value;
  const copy = CONTACT_COPY[method] || CONTACT_COPY.whatsapp;
  document.getElementById('contactValueLabel').textContent = copy.label;
  document.getElementById('contactValue').placeholder = copy.placeholder;
  document.getElementById('contactValueHint').textContent = copy.hint;
}
document.getElementById('contactMethod').addEventListener('change', updateContactCopy);

document.getElementById('btnSaveContact').addEventListener('click', async () => {
  const msg = document.getElementById('contactMsg');
  const btn = document.getElementById('btnSaveContact');
  btn.disabled = true; btn.textContent = 'Guardando…';
  msg.textContent = ''; msg.className = 'form-msg';

  const payload = {
    contact_method: document.getElementById('contactMethod').value,
    contact_value: document.getElementById('contactValue').value.trim() || null,
    contact_message: document.getElementById('contactMessage').value.trim() || null
  };

  const { error } = await window.db.from('stores').update(payload).eq('id', STORE.id);
  btn.disabled = false; btn.textContent = 'Guardar contacto';

  if (error) { msg.textContent = 'No se pudo guardar.'; msg.className = 'form-msg is-error'; return; }
  Object.assign(STORE, payload);
  msg.textContent = 'Guardado.'; msg.className = 'form-msg is-ok';
  toast('Datos de contacto guardados');
});

/* ============================================================================
   IMAGE HELPERS — compression + Supabase Storage
============================================================================ */
function compressImage(file, { maxDim = 1280, quality = 0.82, mime = 'image/jpeg' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else { width = Math.round(width * (maxDim / height)); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.'));
      }, mime, quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

async function uploadStoreAsset(path, blob) {
  const { error } = await window.db.storage.from('store-assets').upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  const { data } = window.db.storage.from('store-assets').getPublicUrl(path);
  return data.publicUrl;
}

function removeStoreAsset(path) {
  if (!path) return;
  window.db.storage.from('store-assets').remove([path]).catch(() => {});
}

/* ============================================================================
   GENERIC DROPZONE WIRING (used by logo, favicon, product image)
============================================================================ */
function setPreview(previewId, dzTextId, removeBtnId, url) {
  const preview = document.getElementById(previewId);
  const dzText = document.getElementById(dzTextId);
  const removeBtn = document.getElementById(removeBtnId);
  if (url) {
    preview.src = url; preview.style.display = '';
    dzText.style.display = 'none';
    removeBtn.style.display = '';
  } else {
    preview.style.display = 'none'; preview.src = '';
    dzText.style.display = '';
    dzText.innerHTML = '<b>Haz clic para subir</b> o arrastra una imagen aquí.';
    removeBtn.style.display = 'none';
  }
}

function wireDropzone({ zone, input, removeBtn, onFile, onRemove }) {
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('is-drag');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFile(f);
  });
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
  removeBtn.addEventListener('click', (e) => { e.stopPropagation(); onRemove(); });
}
