export type ProofLoopStorageMode = "local" | "cloud";

/**
 * Get the current storage mode from environment variable.
 * - "local": Use local runs/, training-data/, evaluation-data/
 * - "cloud": Use Supabase Postgres + Supabase Storage
 */
export function getStorageMode(): ProofLoopStorageMode {
  return process.env.PROOFLOOP_STORAGE_MODE === "cloud" ? "cloud" : "local";
}

/**
 * Check if running in cloud mode
 */
export function isCloudMode(): boolean {
  return getStorageMode() === "cloud";
}

/**
 * Check if running in local mode
 */
export function isLocalMode(): boolean {
  return getStorageMode() === "local";
}
