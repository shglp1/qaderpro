/**
 * Copy to js/config.js and add your Supabase anon key + URL.
 * Never use service_role in the browser.
 */
window.QADER_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  siteRowId: 'main',
  contactSheetWebhookUrl: '',
  /** Public bucket for admin image uploads — create + run supabase/storage-policies.sql */
  mediaBucket: 'site-media'
};
