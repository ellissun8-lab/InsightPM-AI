const BASE = "";

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function uploadCsv(
  caseName: string,
  file: File
): Promise<{ ok: boolean; path: string }> {
  const form = new FormData();
  form.append("caseName", caseName);
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  return res.json();
}

export async function startAnalysis(
  caseName: string,
  dataset: string,
  count: number
): Promise<{ ok: boolean; pid?: number }> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseName, dataset, count }),
  });
  return res.json();
}
