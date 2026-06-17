/**
 * Small, framework-free helpers shared by the storefront and the admin app.
 */
window.Catalog = window.Catalog || {};

(function (C) {
  // ── i18n ──────────────────────────────────────────────────────────────
  // Add a language by adding a key here. Every page reads C.t(key) after
  // C.setLocale(store.locale) is called once.
  const STRINGS = {
    es: {
      all: 'Todo', search_placeholder: 'Buscar...', filters: 'Filtros',
      brand: 'Marca', category: 'Categoría', condition: 'Condición',
      stock: 'Disponibilidad', max_price: 'Precio máx.', clear: 'Borrar todo',
      apply: 'Aplicar filtros', close: 'Cerrar', new: 'Nuevo', used: 'Usado',
      in_stock: 'Disponible', out_of_stock: 'No disponible', preorder: 'Preventa',
      show_details: 'Ver detalles', hide_details: 'Ocultar', no_description: 'Sin descripción.',
      showing: 'Mostrando', of: 'de', products: 'productos', prev: 'Anterior', next: 'Siguiente',
      ask: 'Preguntar', call: 'Llamar', email: 'Escribir', visit: 'Visitar',
      add_to_inquiry: 'Agregar', inquiry_cart: 'Mi pedido', send_inquiry: 'Enviar pedido',
      remove: 'Quitar', empty_cart: 'Aún no agregaste productos.', total: 'Total',
      not_found_title: 'Catálogo no encontrado',
      not_found_body: 'No encontramos esta tienda, o está temporalmente desactivada.',
      load_error: 'Error al cargar el catálogo. Por favor recarga la página.',
      share: 'Compartir', copied: 'Enlace copiado'
    },
    en: {
      all: 'All', search_placeholder: 'Search...', filters: 'Filters',
      brand: 'Brand', category: 'Category', condition: 'Condition',
      stock: 'Availability', max_price: 'Max price', clear: 'Clear all',
      apply: 'Apply filters', close: 'Close', new: 'New', used: 'Used',
      in_stock: 'In stock', out_of_stock: 'Out of stock', preorder: 'Pre-order',
      show_details: 'Show details', hide_details: 'Hide', no_description: 'No description.',
      showing: 'Showing', of: 'of', products: 'products', prev: 'Prev', next: 'Next',
      ask: 'Ask', call: 'Call', email: 'Email', visit: 'Visit',
      add_to_inquiry: 'Add', inquiry_cart: 'My order', send_inquiry: 'Send order',
      remove: 'Remove', empty_cart: 'No products added yet.', total: 'Total',
      not_found_title: 'Catalog not found',
      not_found_body: "We couldn't find this store, or it's temporarily disabled.",
      load_error: 'Could not load the catalog. Please reload the page.',
      share: 'Share', copied: 'Link copied'
    }
  };

  let _locale = 'es';
  C.setLocale = function (locale) { _locale = STRINGS[locale] ? locale : 'es'; };
  C.t = function (key) { return (STRINGS[_locale] && STRINGS[_locale][key]) || key; };

  // ── Formatting ───────────────────────────────────────────────────────
  C.formatMoney = function (amount, currency) {
    const n = parseFloat(amount || 0);
    try {
      return new Intl.NumberFormat(_locale === 'es' ? 'es-MX' : 'en-US', {
        style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2
      }).format(n);
    } catch (e) {
      return `$${n.toFixed(2)} ${currency || ''}`;
    }
  };

  // ── Contact link building ───────────────────────────────────────────
  // store: a row from public.stores. item or items: product(s) being asked about.
  function fillTemplate(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  }

  C.buildSingleItemMessage = function (store, product) {
    const tpl = store.contact_message ||
      (_locale === 'es'
        ? 'Hola {store}, me interesa: {name} ({price}). ¿Sigue disponible?'
        : 'Hi {store}, I am interested in: {name} ({price}). Is it still available?');
    return fillTemplate(tpl, {
      store: store.name,
      name: product.name,
      price: C.formatMoney(product.price, store.currency)
    });
  };

  C.buildCartMessage = function (store, items) {
    const lines = items.map(i =>
      `• ${i.qty}x ${i.name} — ${C.formatMoney(i.price * i.qty, store.currency)}`
    );
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const header = _locale === 'es'
      ? `Hola ${store.name}, quiero preguntar por:`
      : `Hi ${store.name}, I'd like to ask about:`;
    const footer = `${C.t('total')}: ${C.formatMoney(total, store.currency)}`;
    return [header, '', ...lines, '', footer].join('\n');
  };

  /** Returns { href, label } for the store's single configured contact action. */
  C.contactAction = function (store, message) {
    const value = (store.contact_value || '').trim();
    switch (store.contact_method) {
      case 'whatsapp': {
        const digits = value.replace(/[^\d]/g, '');
        return { href: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`, label: C.t('ask') };
      }
      case 'email':
        return {
          href: `mailto:${value}?subject=${encodeURIComponent(store.name)}&body=${encodeURIComponent(message)}`,
          label: C.t('email')
        };
      case 'phone':
        return { href: `tel:${value}`, label: C.t('call') };
      default:
        return { href: value || '#', label: C.t('visit') };
    }
  };

  C.supportsCart = function (store) {
    return store.contact_method === 'whatsapp' || store.contact_method === 'email';
  };

  // ── Misc ────────────────────────────────────────────────────────────
  C.debounce = function (fn, ms) {
    let h;
    return function (...args) {
      clearTimeout(h);
      h = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  C.escapeHtml = function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
})(window.Catalog);
