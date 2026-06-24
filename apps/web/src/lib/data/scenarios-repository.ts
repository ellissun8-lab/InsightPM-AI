import { isCloudMode } from "./storage-mode";

export interface CustomScenario {
  id: string;
  scenarioId: string;
  label: string;
  businessGoal: string;
  description: string;
  defaultMetrics: string[];
  defaultSegments: string[];
  issueKeywordMap: Record<string, any>;
  priorityRules: Record<string, any>;
}

const DEMO_SCENARIOS: CustomScenario[] = [
  {
    id: "demo-1",
    scenarioId: "education-saas-retention",
    label: "教育 SaaS 课程留存",
    businessGoal: "提升课程完成率",
    description: "分析教育平台用户反馈，识别课程留存障碍",
    defaultMetrics: ["课程完成率", "学习时长", "互动频率"],
    defaultSegments: ["新用户", "活跃用户", "流失用户"],
    issueKeywordMap: {},
    priorityRules: {},
  },
  {
    id: "demo-2",
    scenarioId: "medical-app-booking",
    label: "医疗 App 预约体验",
    businessGoal: "提升预约成功率",
    description: "分析医疗预约应用的用户反馈",
    defaultMetrics: ["预约成功率", "等待时间", "取消率"],
    defaultSegments: ["门诊", "检查", "手术"],
    issueKeywordMap: {},
    priorityRules: {},
  },
];

/**
 * Get all custom scenarios
 */
export async function getCustomScenarios(
  workspaceId?: string
): Promise<CustomScenario[]> {
  if (isCloudMode()) {
    return getCustomScenariosFromSupabase(workspaceId);
  }
  return getDemoScenarios();
}

/**
 * Create a new custom scenario
 */
export async function createCustomScenario(
  input: Omit<CustomScenario, "id">,
  workspaceId?: string
): Promise<CustomScenario | null> {
  if (isCloudMode()) {
    return createCustomScenarioInSupabase(input, workspaceId);
  }
  // Local mode: scenarios are not persisted
  return { ...input, id: `demo-${Date.now()}` };
}

/**
 * Update a custom scenario
 */
export async function updateCustomScenario(
  id: string,
  input: Partial<CustomScenario>,
  workspaceId?: string
): Promise<boolean> {
  if (isCloudMode()) {
    return updateCustomScenarioInSupabase(id, input, workspaceId);
  }
  // Local mode: scenarios are not persisted
  return true;
}

/**
 * Delete a custom scenario
 */
export async function deleteCustomScenario(
  id: string,
  workspaceId?: string
): Promise<boolean> {
  if (isCloudMode()) {
    return deleteCustomScenarioFromSupabase(id, workspaceId);
  }
  // Local mode: scenarios are not persisted
  return true;
}

// ===========================================
// Local Mode Implementation
// ===========================================

function getDemoScenarios(): CustomScenario[] {
  return [...DEMO_SCENARIOS];
}

// ===========================================
// Supabase Mode Implementation
// ===========================================

async function getSupabaseClient() {
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

async function getCustomScenariosFromSupabase(
  workspaceId?: string
): Promise<CustomScenario[]> {
  if (!workspaceId) {
    return [];
  }

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("custom_scenarios")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching custom scenarios from Supabase:", error);
    return [];
  }

  return (data || []).map(mapSupabaseScenario);
}

async function createCustomScenarioInSupabase(
  input: Omit<CustomScenario, "id">,
  workspaceId?: string
): Promise<CustomScenario | null> {
  if (!workspaceId) {
    return null;
  }

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("custom_scenarios")
    .insert({
      workspace_id: workspaceId,
      scenario_id: input.scenarioId,
      label: input.label,
      business_goal: input.businessGoal,
      description: input.description,
      default_metrics: input.defaultMetrics,
      default_segments: input.defaultSegments,
      issue_keyword_map: input.issueKeywordMap,
      priority_rules: input.priorityRules,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating custom scenario in Supabase:", error);
    return null;
  }

  return mapSupabaseScenario(data);
}

async function updateCustomScenarioInSupabase(
  id: string,
  input: Partial<CustomScenario>,
  workspaceId?: string
): Promise<boolean> {
  if (!workspaceId) {
    return false;
  }

  const supabase = await getSupabaseClient();

  const updateData: any = {};
  if (input.label) updateData.label = input.label;
  if (input.businessGoal) updateData.business_goal = input.businessGoal;
  if (input.description) updateData.description = input.description;
  if (input.defaultMetrics) updateData.default_metrics = input.defaultMetrics;
  if (input.defaultSegments)
    updateData.default_segments = input.defaultSegments;
  if (input.issueKeywordMap)
    updateData.issue_keyword_map = input.issueKeywordMap;
  if (input.priorityRules) updateData.priority_rules = input.priorityRules;

  const { error } = await supabase
    .from("custom_scenarios")
    .update(updateData)
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  return !error;
}

async function deleteCustomScenarioFromSupabase(
  id: string,
  workspaceId?: string
): Promise<boolean> {
  if (!workspaceId) {
    return false;
  }

  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("custom_scenarios")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  return !error;
}

// ===========================================
// Helpers
// ===========================================

function mapSupabaseScenario(row: any): CustomScenario {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    label: row.label,
    businessGoal: row.business_goal || "",
    description: row.description || "",
    defaultMetrics: row.default_metrics || [],
    defaultSegments: row.default_segments || [],
    issueKeywordMap: row.issue_keyword_map || {},
    priorityRules: row.priority_rules || {},
  };
}
