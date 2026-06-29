import { supabase } from "./supabase.js";

/**
 * Worker Heartbeat 管理
 * 定期更新 run 的 heartbeat_at，防止被判定为 stale
 */

let heartbeatInterval: NodeJS.Timeout | null = null;
let currentRunId: string | null = null;

/**
 * 启动 heartbeat
 */
export function startHeartbeat(runId: string, intervalMs: number = 30000) {
  stopHeartbeat(); // 先停止之前的
  currentRunId = runId;

  console.log(`[Heartbeat] Started for run ${runId}, interval: ${intervalMs}ms`);

  heartbeatInterval = setInterval(async () => {
    if (!currentRunId) return;

    try {
      const { error } = await supabase
        .from("runs")
        .update({
          heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentRunId)
        .eq("status", "running");

      if (error) {
        console.warn(`[Heartbeat] Failed to update:`, error.message);
      } else {
        console.log(`[Heartbeat] Updated run ${currentRunId}`);
      }
    } catch (err: any) {
      console.warn(`[Heartbeat] Error:`, err.message);
    }
  }, intervalMs);
}

/**
 * 更新 heartbeat 并记录 worker step
 */
export async function updateHeartbeat(runId: string, workerStep: string) {
  try {
    const { error } = await supabase
      .from("runs")
      .update({
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: supabase.rpc ? undefined : {
          workerStep,
          workerHeartbeatAt: new Date().toISOString(),
        },
      })
      .eq("id", runId)
      .eq("status", "running");

    if (error) {
      console.warn(`[Heartbeat] Failed to update step:`, error.message);
    }
  } catch (err: any) {
    console.warn(`[Heartbeat] Error updating step:`, err.message);
  }
}

/**
 * 停止 heartbeat
 */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log(`[Heartbeat] Stopped for run ${currentRunId}`);
    currentRunId = null;
  }
}
