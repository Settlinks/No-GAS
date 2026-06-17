/**
 * ============================================================================
 * SITE CONFIGURATION — edit this file, nothing else, to connect a deployment
 * to your Supabase project.
 * ============================================================================
 *
 * SUPABASE_URL / SUPABASE_ANON_KEY
 *   Find both in your Supabase project → Settings → API.
 *   The "anon" key is PUBLIC by design — it is meant to be visible in
 *   browser code. It can only do what your Row Level Security policies
 *   (supabase/schema.sql) allow it to do. Never put the "service_role" key
 *   here or anywhere in this repo.
 *
 * DEFAULT_STORE_SLUG
 *   - Leave as null  → this deployment is a shared directory; every catalog
 *     is reached as yoursite.com/?store=the-slug (good for one GitHub repo
 *     serving many clients).
 *   - Set to a slug, e.g. 'panaderia-lupe' → this deployment always shows
 *     that one store, no ?store= needed (good when a client wants their own
 *     repo/custom domain that only ever shows their own catalog).
 */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://drqrkgavtqeyoykktkyo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_sX1kIW29T_PboktLin3kSA_JfrbKalj',
  DEFAULT_STORE_SLUG: null
};
