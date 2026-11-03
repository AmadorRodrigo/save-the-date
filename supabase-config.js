// Preencha com a URL e a chave publicável (anon) do projeto Supabase.
// Nunca use a chave service_role neste arquivo.
export const SUPABASE_URL = "COLE_AQUI_A_URL_DO_PROJETO";
export const SUPABASE_ANON_KEY = "COLE_AQUI_A_CHAVE_PUBLICAVEL";
export const supabaseConfigured = SUPABASE_URL.startsWith("https://")
  && !SUPABASE_URL.includes("COLE_AQUI")
  && SUPABASE_ANON_KEY.length > 20
  && !SUPABASE_ANON_KEY.includes("COLE_AQUI");
