// Preencha com a URL e a chave publicável (anon) do projeto Supabase.
// Nunca use a chave service_role neste arquivo.
export const SUPABASE_URL = "https://ghhlhxgedkpvmohqnrnm.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_dHKVUz3L_Uh0uigTqSpUgg_KWU0vl1l";
export const supabaseConfigured = SUPABASE_URL.startsWith("https://")
  && !SUPABASE_URL.includes("COLE_AQUI")
  && SUPABASE_ANON_KEY.length > 20
  && !SUPABASE_ANON_KEY.includes("COLE_AQUI");
