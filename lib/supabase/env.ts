let hasLoggedSupabaseEnvStatus = false;

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasLoggedSupabaseEnvStatus) {
    console.info("[supabase-env]", {
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
    });
    hasLoggedSupabaseEnvStatus = true;
  }

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return {
    url,
    anonKey,
  };
}
