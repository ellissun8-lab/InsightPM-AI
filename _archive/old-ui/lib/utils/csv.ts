export interface ParsedCsvRow {
  content: string;
  user_type?: string;
  source?: string;
  created_at?: string;
  [key: string]: string | undefined;
}

const CONTENT_COLUMNS = [
  "content",
  "feedback",
  "message",
  "comment",
  "text",
  "用户反馈",
  "反馈内容",
  "评论",
  "内容",
];

const USER_TYPE_COLUMNS = ["user_type", "用户类型"];
const SOURCE_COLUMNS = ["source", "来源"];
const DATE_COLUMNS = ["created_at", "时间", "日期"];

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseCsv(text: string): ParsedCsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const contentIdx = findColumnIndex(headers, CONTENT_COLUMNS);
  const userTypeIdx = findColumnIndex(headers, USER_TYPE_COLUMNS);
  const sourceIdx = findColumnIndex(headers, SOURCE_COLUMNS);
  const dateIdx = findColumnIndex(headers, DATE_COLUMNS);

  // If no content column found, use first column
  const effectiveContentIdx = contentIdx === -1 ? 0 : contentIdx;

  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;

    const content = (values[effectiveContentIdx] || "").trim();
    if (!content || content.length < 3) continue;

    rows.push({
      content: content.substring(0, 5000),
      user_type: userTypeIdx >= 0 ? values[userTypeIdx]?.trim() : undefined,
      source: sourceIdx >= 0 ? values[sourceIdx]?.trim() : undefined,
      created_at: dateIdx >= 0 ? values[dateIdx]?.trim() : undefined,
    });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}
