interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  /** off | memory | supabase. Unset: supabase when the two values below are set, else off. */
  readonly VITE_AUTH_MODE?: string;
  /** Public values (the anon key is meant for browsers; RLS guards the data). */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
