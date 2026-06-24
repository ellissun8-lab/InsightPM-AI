export interface ParsedTextRow {
  content: string;
}

export function parseTxt(text: string): ParsedTextRow[] {
  const lines = text.split(/\r?\n/);
  const rows: ParsedTextRow[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length < 3) continue;

    rows.push({
      content: trimmed.substring(0, 5000),
    });
  }

  return rows;
}
