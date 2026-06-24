import { isCloudMode } from "./storage-mode";

export interface WorkspaceSettings {
  workspaceName: string;
  shareApproval: boolean;
  model: string;
  threshold: number;
  defaultScenario: string;
  maxUpload: number;
  hardValidation: boolean;
  semanticValidation: boolean;
  minEvidence: string;
  exportFormats: {
    markdown: boolean;
    json: boolean;
    csv: boolean;
    zip: boolean;
    pdf: boolean;
  };
  autoSave: boolean;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  workspaceName: "Acme Corp 研究室",
  shareApproval: true,
  model: "deepseek-v4-pro",
  threshold: 85,
  defaultScenario: "auto",
  maxUpload: 10,
  hardValidation: true,
  semanticValidation: true,
  minEvidence: "3条",
  exportFormats: {
    markdown: true,
    json: true,
    csv: true,
    zip: false,
    pdf: true,
  },
  autoSave: true,
};

/**
 * Get workspace settings
 */
export async function getWorkspaceSettings(
  workspaceId?: string
): Promise<WorkspaceSettings> {
  if (isCloudMode()) {
    return getWorkspaceSettingsFromSupabase(workspaceId);
  }
  return getDefaultSettings();
}

/**
 * Update workspace settings
 */
export async function updateWorkspaceSettings(
  settings: Partial<WorkspaceSettings>,
  workspaceId?: string
): Promise<boolean> {
  if (isCloudMode()) {
    return updateWorkspaceSettingsInSupabase(settings, workspaceId);
  }
  // Local mode: settings are not persisted
  return true;
}

// ===========================================
// Local Mode Implementation
// ===========================================

function getDefaultSettings(): WorkspaceSettings {
  return { ...DEFAULT_SETTINGS };
}

// ===========================================
// Supabase Mode Implementation
// ===========================================

async function getSupabaseClient() {
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

async function getWorkspaceSettingsFromSupabase(
  workspaceId?: string
): Promise<WorkspaceSettings> {
  if (!workspaceId) {
    return getDefaultSettings();
  }

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("workspace_settings")
    .select("settings")
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) {
    return getDefaultSettings();
  }

  return { ...DEFAULT_SETTINGS, ...data.settings };
}

async function updateWorkspaceSettingsInSupabase(
  settings: Partial<WorkspaceSettings>,
  workspaceId?: string
): Promise<boolean> {
  if (!workspaceId) {
    return false;
  }

  const supabase = await getSupabaseClient();

  const { error } = await supabase.from("workspace_settings").upsert(
    {
      workspace_id: workspaceId,
      settings: settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );

  return !error;
}
