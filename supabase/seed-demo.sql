-- ============================================================================
-- OPTIONAL DEMO SEED
-- ============================================================================
-- Run this after schema.sql to see a working catalog immediately, with no
-- client and no invited owner needed yet. It only touches the public
-- storefront (no admin login exists for it).
--
-- View it at:  index.html?store=demo  (after you've deployed, or open
-- index.html locally with config.js pointed at your project)
--
-- Safe to re-run — it clears its own rows first. Delete it any time with:
--   delete from public.stores where slug = 'demo';   (cascades to its rows)
-- ============================================================================

delete from public.stores where slug = 'demo';

with new_store as (
  insert into public.stores (
    slug, name, tagline, business_type,
    theme_mode, accent_color, bg_color, surface_color, text_color,
    currency, locale, contact_method, contact_value, is_active
  ) values (
    'demo', 'Panadería Demo', 'Pan recién horneado todos los días', 'bakery',
    'dark', '#63d2ff', '#1a1a1a', '#252525', '#eef2f7',
    'MXN', 'es', 'whatsapp', '529990000000', true
  )
  returning id
),
cat_pasteles as (
  insert into public.categories (store_id, name, sort_order)
  select id, 'Pasteles', 0 from new_store returning id, store_id
),
cat_panes as (
  insert into public.categories (store_id, name, sort_order)
  select id, 'Panes', 1 from new_store returning id, store_id
),
cat_bebidas as (
  insert into public.categories (store_id, name, sort_order)
  select id, 'Bebidas', 2 from new_store returning id, store_id
)
insert into public.products (
  store_id, category_id, name, description, price, compare_at_price,
  brand, condition, image_url, stock_status, badge_text, badge_color, featured, visible, sort_order
)
select s.id, c.id, v.name, v.description, v.price, v.compare_at_price,
       null, null, v.image_url, v.stock_status, v.badge_text, '#f87171', v.featured, true, v.sort_order
from new_store s
cross join (values
  ('Pastel de chocolate', 'Bizcocho de chocolate con relleno de cajeta y ganache.', 320.00, 380.00, 'https://placehold.co/600x600/1a1a1e/63d2ff?text=Pastel', 'in_stock', 'Oferta', true, 0, 'pasteles'),
  ('Pastel de tres leches', 'Esponjoso, bañado en tres leches con un toque de canela.', 280.00, null, 'https://placehold.co/600x600/1a1a1e/63d2ff?text=3+Leches', 'in_stock', null, true, 1, 'pasteles'),
  ('Cupcakes de vainilla (caja de 6)', 'Cupcakes esponjosos con betún de vainilla.', 150.00, null, 'https://placehold.co/600x600/1a1a1e/63d2ff?text=Cupcakes', 'in_stock', 'Nuevo', false, 2, 'pasteles'),
  ('Bolillo', 'Pan blanco crujiente, ideal para tortas.', 8.00, null, 'https://placehold.co/600x600/1a1a1e/63d2ff?text=Bolillo', 'in_stock', null, false, 3, 'panes'),
  ('Concha de vainilla', 'Pan dulce tradicional con cubierta de azúcar.', 14.00, null, 'https://placehold.co/600x600/1a1a1e/63d2ff?text=Concha', 'in_stock', null, true, 4, 'panes'),
  ('Café americano', 'Café de grano recién molido.', 35.00, null, 'https://placehold.co/600x600/1a1a1e/63d2ff?text=Café', 'out_of_stock', null, false, 5, 'bebidas')
) as v(name, description, price, compare_at_price, image_url, stock_status, badge_text, featured, sort_order, cat_key)
join (
  select 'pasteles' as key, id, store_id from cat_pasteles
  union all select 'panes', id, store_id from cat_panes
  union all select 'bebidas', id, store_id from cat_bebidas
) c on c.key = v.cat_key;
