import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function callEdgeFunction<T>(name: string, init?: RequestInit) {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) },
    ...init,
  });
  if (error) {
    throw error;
  }
  return data as T;
}
