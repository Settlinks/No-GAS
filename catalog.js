/* ============================================================================
   CATALOG STOREFRONT
   One store per page load, resolved from ?store=slug (or APP_CONFIG.DEFAULT_STORE_SLUG).
   Everything below adapts to whatever that store's row + products contain —
   there is nothing business-specific hardcoded in this file.
============================================================================ */
const C = window.Catalog;

/* ── STATE ── */
let STORE          = null;
let products        = [];
let currentPage      = 1;
const itemsPerPage   = 20;

let _bannerPool = [], bannerQueue = [], bannerIndex = 0, bannerTimer = null;
let _poolCursor = 0;

let cart = []; // [{id,name,price,qty,image_url}]

/* ============================================================================
   BOOT
============================================================================ */
function getSlug() {
  const fromUrl = new URLSearchParams(location.search).get('store');
  return fromUrl || (window.APP_CONFIG && window.APP_CONFIG.DEFAULT_STORE_SLUG) || null;
}

function showFatalState(titleKey, bodyKey, icon) {
  document.querySelector('.page-body').style.display = 'none';
  document.getElementById('bannerSection').classList.add('is-empty');
  const wrap = document.createElement('div');
  wrap.className = 'state-card';
  wrap.innerHTML = `<div class="icon">${icon}</div><h2>${C.t(titleKey)}</h2><p>${C.t(bodyKey)}</p>`;
  document.body.appendChild(wrap);
}

async function boot() {
  showSkeleton();
  const slug = getSlug();
  if (!slug) { C.setLocale('es'); showFatalState('not_found_title', 'not_found_body', '🗂️'); return; }

  const { data: store, error } = await window.db
    .from('stores').select('*').eq('slug', slug).eq('is_active', true).single();

  if (error || !store) {
    C.setLocale('es');
    showFatalState('not_found_title', 'not_found_body', '🗂️');
    return;
  }

  STORE = store;
  C.setLocale(store.locale || 'es');
  applyTheme(store);
  applyStoreChrome(store);
  cart = loadCart();

  const { data: rows, error: perr } = await window.db
    .from('products')
    .select('*, category:categories(id,name)')
    .eq('store_id', store.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (perr) {
    document.getElementById('grid').className = 'grid';
    document.getElementById('grid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--red)">
         <div style="font-size:32px;margin-bottom:12px">⚠</div>
         <div style="font-family:var(--font-mono);font-size:12px;letter-spacing:.15em;text-transform:uppercase">${C.t('load_error')}</div>
       </div>`;
    return;
  }

  products = (rows || []).map(r => ({ ...r, category_name: r.category ? r.category.name : null }));
  populateFilters(products);
  renderAll();
  renderCartFab();

  const wantedProductId = new URLSearchParams(location.search).get('p');
  if (wantedProductId) {
    const found = products.find(p => String(p.id) === wantedProductId);
    if (found) openProductModal(found);
  }
}

function applyStoreChrome(store) {
  const logo = document.getElementById('hdrLogo');
  const title = document.getElementById('hdrTitle');
  const dot = document.getElementById('hdrDot');
  if (store.logo_url) { logo.src = store.logo_url; logo.style.display = ''; dot.style.display = 'none'; }
  title.textContent = store.name || 'Catálogo';

  document.getElementById('search').placeholder = C.t('search_placeholder');
  document.getElementById('filterToggleLabel').textContent = C.t('filters');
  document.getElementById('sidebarTitle').textContent = C.t('filters');
  document.getElementById('lblCategory').textContent = C.t('category');
  document.getElementById('lblBrand').textContent = C.t('brand');
  document.getElementById('lblCondition').textContent = C.t('condition');
  document.getElementById('lblStock').textContent = C.t('stock');
  document.getElementById('lblPrice').textContent = C.t('max_price');
  document.getElementById('priceFilter').placeholder = 'Ej: 500';
  ['lblClear1', 'lblClear2'].forEach(id => document.getElementById(id).textContent = C.t('clear'));
  document.getElementById('lblApply').textContent = C.t('apply');
  document.getElementById('bmodalClose').textContent = C.t('close');
  document.getElementById('bmodalShareLabel').textContent = C.t('share');
  document.getElementById('cartTitle').textContent = C.t('inquiry_cart');
  document.getElementById('cartFabLabel').textContent = C.t('inquiry_cart');
  document.getElementById('cartTotalLabel').textContent = C.t('total');
  document.getElementById('cartSendBtn').textContent = C.t('send_inquiry');
}

document.addEventListener('DOMContentLoaded', boot);

/* ============================================================================
   SKELETON / TOAST / HEADER OFFSET / SIDEBAR  (unchanged behaviour, ported)
============================================================================ */
function showSkeleton() {
  const grid = document.getElementById('grid');
  grid.className = 'skel-grid';
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="skel-card">
      <div class="skel-img"></div>
      <div class="skel-line med"></div>
      <div class="skel-line short"></div>
      <div class="skel-line short"></div>
      <div class="skel-btn"></div>
    </div>`).join('');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function applyHeaderOffset() {
  const hdr = document.querySelector('header');
  const body = document.querySelector('.page-body');
  if (!hdr || !body) return;
  const h = Math.ceil(hdr.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hdr', h + 'px');
  body.style.marginTop = h + 'px';
  body.style.height = 'calc(100dvh - ' + h + 'px)';
}
window.addEventListener('load', applyHeaderOffset);
window.addEventListener('resize', applyHeaderOffset);
requestAnimationFrame(() => requestAnimationFrame(applyHeaderOffset));
setTimeout(applyHeaderOffset, 400);

const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebarBackdrop');
const toggleBtn = document.getElementById('filterToggle');
const closeBtn = document.getElementById('sidebarClose');

function openSidebar() { sidebar.classList.add('open'); backdrop.classList.add('visible'); toggleBtn.classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.remove('visible'); toggleBtn.classList.remove('active'); document.body.style.overflow = ''; }
function toggleSidebar() { sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); }
toggleBtn.addEventListener('click', toggleSidebar);
closeBtn.addEventListener('click', closeSidebar);
backdrop.addEventListener('click', closeSidebar);
document.getElementById('mobileApply').addEventListener('click', closeSidebar);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSidebar(); closeProductModal(); closeCartPanel(); } });

/* ============================================================================
   FILTERS — built from whatever data actually exists, irrelevant ones hide
============================================================================ */
const STOCK_LABEL_KEY = { in_stock: 'in_stock', out_of_stock: 'out_of_stock', preorder: 'preorder' };

function hideIfEmpty(groupId, select) {
  document.getElementById(groupId).classList.toggle('is-hidden', select.options.length <= 1);
}

function populateFilters(list) {
  const catSelect = document.getElementById('categoryFilter');
  const cats = [...new Set(list.map(p => p.category_name).filter(Boolean))].sort();
  catSelect.innerHTML = `<option value="">${C.t('all')}</option>` + cats.map(c => `<option value="${C.escapeHtml(c)}">${C.escapeHtml(c)}</option>`).join('');
  hideIfEmpty('groupCategory', catSelect);

  const brandSelect = document.getElementById('brandFilter');
  const brands = [...new Set(list.map(p => p.brand).filter(Boolean))].sort();
  brandSelect.innerHTML = `<option value="">${C.t('all')}</option>` + brands.map(b => `<option value="${C.escapeHtml(b)}">${C.escapeHtml(b)}</option>`).join('');
  hideIfEmpty('groupBrand', brandSelect);

  const condSelect = document.getElementById('condFilter');
  const conds = [...new Set(list.map(p => p.condition).filter(Boolean))].sort();
  condSelect.innerHTML = `<option value="">${C.t('all')}</option>` + conds.map(v => `<option value="${C.escapeHtml(v)}">${C.escapeHtml(v)}</option>`).join('');
  hideIfEmpty('groupCondition', condSelect);

  const stockSelect = document.getElementById('stockFilter');
  const stocks = [...new Set(list.map(p => p.stock_status).filter(Boolean))];
  stockSelect.innerHTML = `<option value="">${C.t('all')}</option>` +
    stocks.map(v => `<option value="${v}">${C.t(STOCK_LABEL_KEY[v] || v)}</option>`).join('');
  hideIfEmpty('groupStock', stockSelect);
}

function updateDropdownsSequentially(filteredList) {
  const mappings = [
    { id: 'categoryFilter', key: 'category_name' },
    { id: 'brandFilter', key: 'brand' },
    { id: 'condFilter', key: 'condition' }
  ];
  mappings.forEach(m => {
    const select = document.getElementById(m.id);
    const saved = select.value;
    const options = [...new Set(filteredList.map(p => p[m.key]).filter(Boolean))].sort();
    select.innerHTML = `<option value="">${C.t('all')}</option>` +
      options.map(v => `<option value="${C.escapeHtml(v)}"${v === saved ? ' selected' : ''}>${C.escapeHtml(v)}</option>`).join('');
  });
}

['search', 'categoryFilter', 'brandFilter', 'condFilter', 'priceFilter', 'stockFilter'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => { currentPage = 1; renderCatalog(); });
});

function clearAllFilters() {
  ['search', 'categoryFilter', 'brandFilter', 'condFilter', 'stockFilter', 'priceFilter']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  currentPage = 1;
  renderCatalog();
  if (window.innerWidth <= 768) closeSidebar();
  showToast(C.t('clear'));
}
document.getElementById('desktopClear').addEventListener('click', clearAllFilters);
document.getElementById('mobileClear').addEventListener('click', clearAllFilters);

/* ============================================================================
   RENDER ALL
============================================================================ */
function renderAll() { renderBannerSlider(); renderCatalog(); }

/* ============================================================================
   BANNER — random-queue slider (ported from the original design, verbatim)
============================================================================ */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function _nextFromPool() {
  if (_poolCursor >= _bannerPool.length) { _bannerPool = shuffleArray(_bannerPool); _poolCursor = 0; }
  return _bannerPool[_poolCursor++];
}

function renderBannerSlider() {
  const section = document.getElementById('bannerSection');
  const featured = products.filter(p => p.featured && p.image_url);
  const eligible = featured.length ? featured : products.filter(p => p.image_url);

  if (!eligible.length) { section.classList.add('is-empty'); return; }
  section.classList.remove('is-empty');

  _bannerPool = shuffleArray(eligible);
  _poolCursor = 0;
  bannerQueue = [_nextFromPool()];
  bannerIndex = 0;

  _renderCurrentSlide();
  startBannerTimer();
}

function _renderCurrentSlide(direction) {
  const track = document.getElementById('bannerTrack');
  const p = bannerQueue[bannerIndex];
  if (!p) return;

  const incoming = document.createElement('div');
  incoming.className = 'banner-slide';
  const img = document.createElement('img');
  img.src = p.image_url;
  img.alt = p.name || '';
  img.loading = 'eager';
  incoming.appendChild(img);

  let _px = 0, _py = 0;
  incoming.addEventListener('pointerdown', e => { _px = e.clientX; _py = e.clientY; }, { passive: true });
  incoming.addEventListener('pointerup', e => {
    if (Math.abs(e.clientX - _px) < 8 && Math.abs(e.clientY - _py) < 8) openProductModal(bannerQueue[bannerIndex]);
  });

  if (!direction) {
    track.innerHTML = '';
    track.appendChild(incoming);
  } else {
    const outgoing = track.querySelector('.banner-slide');
    const enterFrom = direction === 'next' ? '100%' : '-100%';
    const exitTo = direction === 'next' ? '-100%' : '100%';
    incoming.style.cssText = `position:absolute;inset:0;transform:translateX(${enterFrom});transition:transform .38s cubic-bezier(0.4,0,0.2,1)`;
    track.style.position = 'relative'; track.style.overflow = 'hidden';
    track.appendChild(incoming);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      incoming.style.transform = 'translateX(0)';
      if (outgoing) {
        outgoing.style.cssText = `position:absolute;inset:0;transform:translateX(0);transition:transform .38s cubic-bezier(0.4,0,0.2,1)`;
        outgoing.style.transform = `translateX(${exitTo})`;
      }
      setTimeout(() => { track.innerHTML = ''; incoming.style.cssText = ''; track.style.position = ''; track.style.overflow = ''; track.appendChild(incoming); }, 390);
    }));
  }

  _updateFilmstrip();
  updateBannerDesc(bannerIndex);
}

function bannerNext() {
  if (bannerIndex < bannerQueue.length - 1) bannerIndex++;
  else { bannerQueue.push(_nextFromPool()); bannerIndex = bannerQueue.length - 1; }
  _renderCurrentSlide('next');
}
function bannerPrev() { if (bannerIndex > 0) { bannerIndex--; _renderCurrentSlide('prev'); } }

function _updateFilmstrip() {
  const dots = document.getElementById('bannerDots');
  const hasPrev = bannerIndex > 0;
  const segs = [hasPrev ? 'seg-far' : 'seg-ghost', hasPrev ? 'seg-near' : 'seg-ghost', 'seg-active', 'seg-near', 'seg-far'];
  dots.innerHTML = segs.map(c => `<span class="bseg ${c}"></span>`).join('');
}

function updateBannerDesc(idx) {
  const el = document.getElementById('bannerDesc');
  const p = bannerQueue[idx];
  if (!p || !el) return;
  const desc = p.description || p.name || '';
  const newText = desc.slice(0, 120) + (desc.length > 120 ? '…' : '');
  el.classList.remove('fade-in'); el.classList.add('fade-out');
  setTimeout(() => { el.textContent = newText; el.classList.remove('fade-out'); el.classList.add('fade-in'); }, 180);
}

document.getElementById('bnavPrev').addEventListener('click', e => { e.stopPropagation(); bannerPrev(); resetBannerTimer(); });
document.getElementById('bnavNext').addEventListener('click', e => { e.stopPropagation(); bannerNext(); resetBannerTimer(); });
function startBannerTimer() {
  if (bannerTimer) clearInterval(bannerTimer);
  if (!STORE || STORE.banner_autoplay === false) return;
  bannerTimer = setInterval(() => { if (_bannerPool.length) bannerNext(); }, 5000);
}
function resetBannerTimer() { startBannerTimer(); }

const bWrap = document.getElementById('bannerWrap');
bWrap.addEventListener('mouseenter', () => clearInterval(bannerTimer));
bWrap.addEventListener('mouseleave', startBannerTimer);

(function () {
  let startX = 0, startY = 0;
  const track = document.getElementById('bannerTrack');
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) { dx < 0 ? bannerNext() : bannerPrev(); resetBannerTimer(); }
  }, { passive: true });
})();

/* ============================================================================
   PRODUCT DETAIL MODAL
============================================================================ */
const STOCK_CLASS = { in_stock: 'ok', out_of_stock: 'out', preorder: 'pre' };

function openProductModal(p) {
  if (!p) return;
  document.getElementById('bmodalImg').src = p.image_url || '';
  document.getElementById('bmodalImg').alt = p.name || '';
  document.getElementById('bmodalName').textContent = p.name || '';
  document.getElementById('bmodalPrice').innerHTML =
    C.formatMoney(p.price, STORE.currency) +
    (p.compare_at_price ? ` <span class="compare">${C.formatMoney(p.compare_at_price, STORE.currency)}</span>` : '');
  document.getElementById('bmodalDescText').textContent = p.description || C.t('no_description');

  const tags = [p.size && `${p.size}`, p.condition, p.brand, p.category_name].filter(Boolean);
  document.getElementById('bmodalMeta').innerHTML = tags.map(t => `<span class="bmodal-tag">${C.escapeHtml(t)}</span>`).join('');

  const stockEl = document.getElementById('bmodalStock');
  stockEl.textContent = C.t(STOCK_LABEL_KEY[p.stock_status] || p.stock_status || '');
  stockEl.className = 'bmodal-stock ' + (STOCK_CLASS[p.stock_status] || 'out');

  const action = C.contactAction(STORE, C.buildSingleItemMessage(STORE, p));
  const buyBtn = document.getElementById('bmodalBuy');
  buyBtn.textContent = action.label + ' →';
  buyBtn.onclick = () => openContact(action.href, STORE.contact_method);
  buyBtn._shareUrl = `${location.origin}${location.pathname}?store=${encodeURIComponent(STORE.slug)}&p=${encodeURIComponent(p.id)}`;

  document.getElementById('bannerModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeProductModal() { document.getElementById('bannerModal').classList.remove('open'); document.body.style.overflow = ''; }
document.getElementById('bmodalClose').addEventListener('click', closeProductModal);
document.getElementById('bannerModal').addEventListener('click', function (e) { if (e.target === this) closeProductModal(); });

function openContact(href, method) {
  if (method === 'phone' || method === 'email') location.href = href;
  else window.open(href, '_blank');
}

/* ============================================================================
   CATALOG GRID
============================================================================ */
function renderCatalog() {
  const q = document.getElementById('search').value.toLowerCase();
  const cat = document.getElementById('categoryFilter').value;
  const brand = document.getElementById('brandFilter').value;
  const cond = document.getElementById('condFilter').value;
  const stock = document.getElementById('stockFilter').value;
  const max = parseFloat(document.getElementById('priceFilter').value);

  const filtered = products.filter(p => {
    const name = (p.name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const price = parseFloat(p.price || 0);
    return (name.includes(q) || desc.includes(q)) &&
      (!cat || p.category_name === cat) &&
      (!brand || p.brand === brand) &&
      (!cond || p.condition === cond) &&
      (!stock || p.stock_status === stock) &&
      (!max || price <= max);
  });

  updateDropdownsSequentially(filtered);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  currentPage = Math.min(currentPage, totalPages || 1);
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  const gridEl = document.getElementById('grid');
  gridEl.className = 'grid';
  gridEl.innerHTML = pageItems.map((p, index) => cardTemplate(p, index)).join('');

  updatePagination(totalPages);
  document.getElementById('totalCount').textContent = `${pageItems.length} ${C.t('of')} ${filtered.length} ${C.t('products')}`;

  const ms = document.querySelector('.main-scroll');
  if (ms) ms.scrollTop = 0;

  // refresh per-card cart-toggle state after re-render
  refreshCartButtons();
}

function cardTemplate(p, index) {
  const meta = [
    p.size ? `${C.escapeHtml(p.size)}` : '',
    p.condition ? `${C.escapeHtml(p.condition)}` : ''
  ].filter(Boolean).map(m => `<div class="card-meta">${m}</div>`).join('');

  const action = C.contactAction(STORE, C.buildSingleItemMessage(STORE, p));
  const showCartToggle = C.supportsCart(STORE);

  return `
    <div class="card" id="card-${index}">
      ${p.badge_text ? `<div class="etiqueta-badge" style="background:${p.badge_color || '#f87171'}">${C.escapeHtml(p.badge_text)}</div>` : ''}

      <div class="card-info-overlay" id="overlay-${index}">
        <div class="card-overlay-desc">${C.escapeHtml(p.description) || C.t('no_description')}</div>
        <div class="card-overlay-actions">
          <button class="close-details" onclick="closeDetails(${index})">✕ ${C.t('close')}</button>
          <button class="btn-share" data-name="${C.escapeHtml(p.name)}" data-url="" data-price="${p.price || 0}" data-tip="card-share-tip-${index}" aria-label="${C.t('share')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <span class="share-tip" id="card-share-tip-${index}">${C.t('copied')}</span>
        </div>
      </div>

      <div class="card-img-wrap" onclick="openProductModal(productById('${p.id}'))">
        <img src="${p.image_url || 'https://placehold.co/300x300/1a1a1e/63d2ff?text=—'}" alt="${C.escapeHtml(p.name)}" loading="lazy">
      </div>

      <div class="card-body">
        <div class="card-name">${C.escapeHtml(p.name) || '—'}</div>
        ${meta}
        <div class="card-price">
          ${C.formatMoney(p.price, STORE.currency)}
          ${p.compare_at_price ? `<span class="compare">${C.formatMoney(p.compare_at_price, STORE.currency)}</span>` : ''}
        </div>
        <div class="card-actions-row">
          <button onclick="toggleDetails(${index})" class="btn-detalles">${C.t('show_details')}</button>
          ${showCartToggle ? `<button class="btn-cart-toggle" data-id="${p.id}" onclick="toggleCartItem('${p.id}')" aria-label="${C.t('add_to_inquiry')}">+</button>` : ''}
        </div>
      </div>

      <div class="card-stock ${STOCK_CLASS[p.stock_status] || 'out'}">${C.t(STOCK_LABEL_KEY[p.stock_status] || p.stock_status || '')}</div>

      <button class="btn-comprar" data-id="${p.id}">${action.label} →</button>
    </div>`;
}

function productById(id) { return products.find(p => String(p.id) === String(id)); }

function updatePagination(totalPages) {
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  if (totalPages <= 1) return;
  const createBtn = (label, page, active = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (active) b.classList.add('active');
    b.onclick = () => { currentPage = page; renderCatalog(); };
    pag.appendChild(b);
  };
  createBtn('← ' + C.t('prev'), Math.max(1, currentPage - 1));
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) createBtn(i, i, i === currentPage);
    else if (Math.abs(i - currentPage) === 2) { const s = document.createElement('span'); s.textContent = '...'; pag.appendChild(s); }
  }
  createBtn(C.t('next') + ' →', Math.min(totalPages, currentPage + 1));
}

/* ============================================================================
   SHARE
============================================================================ */
function shareProduct(e, name, url, price) {
  e && e.stopPropagation();
  let safeUrl = (url || '').trim();
  if (!safeUrl.match(/^https?:\/\//i)) safeUrl = window.location.href;
  const shareText = `${name} — ${C.formatMoney(price, STORE.currency)}`;
  const shareData = { title: name, text: shareText, url: safeUrl };

  const showTip = id => {
    const tip = id ? document.getElementById(id) : null;
    if (tip) { tip.classList.add('show'); setTimeout(() => tip.classList.remove('show'), 1800); }
    else showToast(C.t('copied'));
  };
  const copyFallback = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(safeUrl).then(() => showTip(null)).catch(() => showToast(C.t('copied')));
    } else {
      const ta = document.createElement('textarea');
      ta.value = safeUrl; ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
      showToast(C.t('copied'));
    }
  };
  if (navigator.share) {
    let canShare = false;
    try { canShare = !navigator.canShare || navigator.canShare(shareData); } catch (_) {}
    if (canShare) { navigator.share(shareData).catch(err => { if (err && err.name !== 'AbortError') copyFallback(); }); return; }
  }
  copyFallback();
}

document.getElementById('grid').addEventListener('click', function (e) {
  const shareBtn = e.target.closest('.btn-share');
  if (shareBtn) {
    shareProduct(e, shareBtn.dataset.name || '', shareBtn.dataset.url || '', shareBtn.dataset.price || 0);
    return;
  }
  const comprarBtn = e.target.closest('.btn-comprar');
  if (comprarBtn) {
    const product = productById(comprarBtn.dataset.id);
    if (!product) return;
    const action = C.contactAction(STORE, C.buildSingleItemMessage(STORE, product));
    openContact(action.href, STORE.contact_method);
  }
});

document.getElementById('bmodalShare').addEventListener('click', function (e) {
  const name = document.getElementById('bmodalName').textContent;
  const price = document.getElementById('bmodalPrice').textContent.replace(/[^0-9.]/g, '');
  const url = document.getElementById('bmodalBuy')._shareUrl || window.location.href;
  shareProduct(e, name, url, price);
});

/* ============================================================================
   CARD DETAIL OVERLAY
============================================================================ */
function toggleDetails(index) {
  const overlay = document.getElementById(`overlay-${index}`);
  if (!overlay) return;
  const opening = !overlay.classList.contains('is-visible');
  document.querySelectorAll('.card-info-overlay.is-visible').forEach(el => el.classList.remove('is-visible'));
  if (opening) {
    overlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    overlay.onclick = e => { if (e.target === overlay) closeDetails(index); };
  } else {
    document.body.style.overflow = '';
  }
}
function closeDetails(index) {
  const overlay = document.getElementById(`overlay-${index}`);
  if (overlay) overlay.classList.remove('is-visible');
  document.body.style.overflow = '';
}

/* ============================================================================
   INQUIRY CART — builds one consolidated WhatsApp/email message
============================================================================ */
function cartKey() { return `catalog_cart_${STORE.slug}`; }
function loadCart() { try { return JSON.parse(localStorage.getItem(cartKey())) || []; } catch (_) { return []; } }
function saveCart() { try { localStorage.setItem(cartKey(), JSON.stringify(cart)); } catch (_) {} }

function toggleCartItem(id) {
  const existing = cart.find(i => i.id === id);
  if (existing) {
    cart = cart.filter(i => i.id !== id);
  } else {
    const p = productById(id);
    if (!p) return;
    cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, image_url: p.image_url });
  }
  saveCart();
  refreshCartButtons();
  renderCartFab();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  renderCartPanel();
  renderCartFab();
}

function removeCartItem(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCartPanel();
  renderCartFab();
  refreshCartButtons();
}

function refreshCartButtons() {
  document.querySelectorAll('.btn-cart-toggle').forEach(btn => {
    const inCart = cart.some(i => i.id === btn.dataset.id);
    btn.classList.toggle('added', inCart);
    btn.textContent = inCart ? '✓' : '+';
  });
}

function renderCartFab() {
  const fab = document.getElementById('cartFab');
  if (!STORE || !C.supportsCart(STORE)) { fab.classList.remove('visible'); return; }
  fab.classList.add('visible');
  document.getElementById('cartFabCount').textContent = cart.reduce((n, i) => n + i.qty, 0);
}

function renderCartPanel() {
  const wrap = document.getElementById('cartItems');
  if (!cart.length) {
    wrap.innerHTML = `<div class="cart-empty">${C.t('empty_cart')}</div>`;
  } else {
    wrap.innerHTML = cart.map(i => `
      <div class="cart-item">
        <img src="${i.image_url || 'https://placehold.co/80x80/1a1a1e/63d2ff?text=—'}" alt="">
        <div class="cart-item-info">
          <div class="cart-item-name">${C.escapeHtml(i.name)}</div>
          <div class="cart-item-price">${C.formatMoney(i.price, STORE.currency)}</div>
        </div>
        <div class="cart-qty">
          <button onclick="changeQty('${i.id}',-1)">−</button>
          <span>${i.qty}</span>
          <button onclick="changeQty('${i.id}',1)">+</button>
        </div>
        <button class="cart-remove" onclick="removeCartItem('${i.id}')" aria-label="${C.t('remove')}">✕</button>
      </div>`).join('');
  }
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById('cartTotalValue').textContent = C.formatMoney(total, STORE.currency);
  document.getElementById('cartSendBtn').disabled = !cart.length;
}

function openCartPanel() { renderCartPanel(); document.getElementById('cartPanel').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeCartPanel() { document.getElementById('cartPanel').classList.remove('open'); document.body.style.overflow = ''; }

document.getElementById('cartFab').addEventListener('click', openCartPanel);
document.getElementById('cartClose').addEventListener('click', closeCartPanel);
document.getElementById('cartPanel').addEventListener('click', e => { if (e.target.id === 'cartPanel') closeCartPanel(); });
document.getElementById('cartSendBtn').addEventListener('click', () => {
  if (!cart.length) return;
  const message = C.buildCartMessage(STORE, cart);
  const action = C.contactAction(STORE, message);
  openContact(action.href, STORE.contact_method);
});
