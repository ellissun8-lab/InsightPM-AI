import { parseCsv, type ParsedCsvRow } from "@/lib/utils/csv";
import { parseTxt, type ParsedTextRow } from "@/lib/utils/text";

export interface ParsedFeedback {
  content: string;
  user_type?: string;
  source?: string;
  created_at?: string;
}

const MAX_ITEMS = 500;

export function parseFeedbackFile(
  filename: string,
  content: string
): ParsedFeedback[] {
  const ext = filename.toLowerCase().split(".").pop();

  let rows: (ParsedCsvRow | ParsedTextRow)[];

  if (ext === "csv") {
    rows = parseCsv(content);
  } else if (ext === "txt") {
    rows = parseTxt(content);
  } else {
    throw new Error("不支持的文件格式，请上传 CSV 或 TXT 文件");
  }

  if (rows.length === 0) {
    throw new Error("文件中没有找到有效的反馈内容");
  }

  // Limit to MAX_ITEMS
  const limited = rows.slice(0, MAX_ITEMS);

  return limited.map((row) => ({
    content: row.content,
    user_type: "user_type" in row ? row.user_type : undefined,
    source: "source" in row ? row.source : undefined,
    created_at: "created_at" in row ? row.created_at : undefined,
  }));
}
