import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin Supabase client for server-side operations only.
 * Uses SUPABASE_SERVICE_ROLE_KEY (full access).
 *
 * ⚠️ WARNING: This client has full admin access to your Supabase project.
 * - NEVER expose this to the client/browser
 * - NEVER import this in Client Components
 * - Only use in API Routes (server-side)
 */
export function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase admin environment variables. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
