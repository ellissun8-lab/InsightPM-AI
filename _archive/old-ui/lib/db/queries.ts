import { createClient } from "@/lib/supabase/server";

export async function getProjects(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProject(projectId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function createProject(
  data: {
    name: string;
    product_type?: string;
    business_goal?: string;
    target_user?: string;
    key_metric?: string;
    description?: string;
  },
  userId: string
) {
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      ...data,
      owner_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return project;
}

export async function getFeedbackBatches(projectId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_batches")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getFeedbackItems(
  batchId: string,
  userId: string,
  limit = 10
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_items")
    .select("*")
    .eq("batch_id", batchId)
    .eq("owner_id", userId)
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getProjectFeedbackCount(
  projectId: string,
  userId: string
) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("feedback_items")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("owner_id", userId);

  if (error) throw error;
  return count ?? 0;
}
