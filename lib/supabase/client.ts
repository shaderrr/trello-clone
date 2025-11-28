// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr"


// create and export a singleton Supabase client
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}