-- ============================================================================
-- CATALOG PLATFORM — SUPABASE SCHEMA
-- ============================================================================
-- One shared Supabase project serves every client ("store"). Each store is a
-- row, not a separate project — that's how this stays inside the free tier
-- no matter how many small businesses you onboard.
--
-- HOW TO RUN THIS FILE:
--   1. Open your Supabase project → SQL Editor → New query.
--   2. Paste this entire file and click "Run".
--   3. It's safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE.
--
-- See docs/01-supabase-setup.md for the full walkthrough.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- STORES  (one row per small-business client)
-- ----------------------------------------------------------------------------
create table if not exists public.stores (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,              -- used in the catalog URL: ?store=slug
  name             text not null,                      -- "Panadería Doña Lupe"
  tagline          text,                                -- short line under the name
  business_type    text,                                -- "bakery" | "fashion" | "electronics" ... (free text, informational)
  logo_url         text,
  favicon_url       text,

  -- Theme (every value here drives a CSS variable at runtime — see shared/theme.js)
  theme_mode       text not null default 'dark',        -- 'dark' | 'light'
  accent_color     text not null default '#63d2ff',
  bg_color         text not null default '#1a1a1a',
  surface_color    text not null default '#252525',
  text_color       text not null default '#eef2f7',
  font_display     text not null default 'Outfit',       -- Google Font family name
  font_mono        text not null default 'DM Mono',

  -- Commerce basics
  currency         text not null default 'USD',
  locale           text not null default 'es',           -- 'es' | 'en'

  -- How a shopper reaches the business (no checkout — these are inquiry catalogs)
  contact_method   text not null default 'whatsapp',      -- 'whatsapp' | 'email' | 'phone' | 'link'
  contact_value    text,                                  -- e.g. "+529991234567", "hola@negocio.com", a URL
  contact_message  text,                                  -- optional template override, see shared/contact.js

  banner_autoplay  boolean not null default true,
  is_active        boolean not null default true,         -- agency kill-switch (pause a non-paying client instantly)
  owner_id         uuid references auth.users(id) on delete set null,

  extra_settings   jsonb not null default '{}'::jsonb,     -- forward-compatible: socials, footer text, etc.

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.stores is 'One row per client business. owner_id links to the Supabase Auth user who manages it via /admin.';

-- ----------------------------------------------------------------------------
-- CATEGORIES  (each store curates its own short list — not the full FB taxonomy)
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  parent_id   uuid references public.categories(id) on delete set null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_categories_store on public.categories(store_id);

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  category_id       uuid references public.categories(id) on delete set null,

  name              text not null,
  description       text,
  price             numeric(12,2) not null default 0,
  compare_at_price  numeric(12,2),                 -- "was $X" — null hides the strike-through

  sku               text,
  brand             text,
  size              text,
  color             text,
  condition         text,                          -- 'New' | 'Used' | free text

  image_url         text,
  image_path        text,                          -- storage object path, kept so we can delete the old file on replace

  stock_status      text not null default 'in_stock',  -- 'in_stock' | 'out_of_stock' | 'preorder'
  badge_text        text,                            -- e.g. "Oferta", "Nuevo" — shown top-left on the card
  badge_color       text default '#f87171',

  gmc_category      text,                            -- optional Facebook/Google taxonomy path, for future ad-catalog export

  featured          boolean not null default false,  -- appears in the homepage banner rotation
  visible           boolean not null default true,
  sort_order        int not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_products_store on public.products(store_id);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_visible on public.products(store_id, visible);

-- ----------------------------------------------------------------------------
-- updated_at auto-touch trigger
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_stores_touch on public.stores;
create trigger trg_stores_touch before update on public.stores
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_products_touch on public.products;
create trigger trg_products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Public (anon key, used by the storefront): read-only, only active stores,
-- only visible products.
-- Owner (logged-in business owner, used by /admin): full read/write, but only
-- on the single store their auth user is linked to.
-- ============================================================================

alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;

-- STORES ----------------------------------------------------------------
drop policy if exists "public can read active stores" on public.stores;
create policy "public can read active stores"
  on public.stores for select
  using (is_active = true);

drop policy if exists "owner can read own store" on public.stores;
create policy "owner can read own store"
  on public.stores for select
  using (auth.uid() = owner_id);

drop policy if exists "owner can update own store" on public.stores;
create policy "owner can update own store"
  on public.stores for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Note: there is no public INSERT policy. New stores are provisioned by you
-- (the agency) via the SQL editor — see docs/03-onboard-new-client.md.

-- CATEGORIES --------------------------------------------------------------
drop policy if exists "public can read categories of active stores" on public.categories;
create policy "public can read categories of active stores"
  on public.categories for select
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.is_active = true)
  );

drop policy if exists "owner can manage own categories" on public.categories;
create policy "owner can manage own categories"
  on public.categories for all
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );

-- PRODUCTS ------------------------------------------------------------------
drop policy if exists "public can read visible products of active stores" on public.products;
create policy "public can read visible products of active stores"
  on public.products for select
  using (
    visible = true
    and exists (select 1 from public.stores s where s.id = store_id and s.is_active = true)
  );

drop policy if exists "owner can manage own products" on public.products;
create policy "owner can manage own products"
  on public.products for all
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );

-- ============================================================================
-- STORAGE  (product photos + logos)
-- ============================================================================
-- Run this part too — it creates one public bucket. Files are organised as
--   {store_id}/products/{filename}
--   {store_id}/logo.{ext}
-- so a single policy can check "does the first folder belong to me?".
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

drop policy if exists "public can view store assets" on storage.objects;
create policy "public can view store assets"
  on storage.objects for select
  using (bucket_id = 'store-assets');

drop policy if exists "owner can upload to own folder" on storage.objects;
create policy "owner can upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'store-assets'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
  );

drop policy if exists "owner can update own folder" on storage.objects;
create policy "owner can update own folder"
  on storage.objects for update
  using (
    bucket_id = 'store-assets'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
  );

drop policy if exists "owner can delete own folder" on storage.objects;
create policy "owner can delete own folder"
  on storage.objects for delete
  using (
    bucket_id = 'store-assets'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- DONE. Next: docs/03-onboard-new-client.md to create your first store.
-- ============================================================================
