/**
 * Shared Supabase client. Loaded after the Supabase UMD bundle and after
 * config.js on every page (see the <script> order in each .html file).
 */
(function () {
  if (!window.APP_CONFIG) {
    throw new Error('config.js must be loaded before shared/supabase-client.js');
  }
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Supabase library failed to load (check your internet connection / CDN block).');
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
    document.body.innerHTML =
      '<div style="font-family:sans-serif;max-width:560px;margin:80px auto;padding:24px;' +
      'border:1px solid #f87171;border-radius:12px;color:#1a1a1a">' +
      '<h2 style="margin:0 0 12px">Configuration needed</h2>' +
      '<p>This site has not been connected to a Supabase project yet. ' +
      'Edit <code>config.js</code> at the root of this repository with your ' +
      'Supabase URL and anon key, then reload.</p></div>';
    throw new Error('Supabase not configured');
  }

  // Exposed as window.db everywhere else.
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
