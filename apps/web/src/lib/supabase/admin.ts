import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client for server-side operations only.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 *
 * ⚠️ WARNING: This client has full admin access to your Supabase project.
 * - NEVER expose this to the client/browser
 * - NEVER import this in Client Components
 * - Only use in API Routes (server-side)
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Validate URL
  if (!supabaseUrl) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL."
    );
  }

  // Validate service role key
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This is required for admin operations."
    );
  }

  // Reject anon key (wrong key type)
  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY appears to be an anon/publishable key. Use the service_role key instead."
    );
  }

  // Reject if same as anon key
  if (serviceRoleKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is the same as NEXT_PUBLIC_SUPABASE_ANON_KEY. Use the service_role key instead."
    );
  }

  // Log key prefix for debugging (without exposing full key)
  console.log(
    "createAdminClient: Using service_role key prefix:",
    serviceRoleKey.substring(0, 10) + "..."
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  });
}
