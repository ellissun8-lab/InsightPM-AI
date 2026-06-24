import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FeedbackItem {
  id: string;
  raw_content: string;
}

interface FeedbackPreviewTableProps {
  items: FeedbackItem[];
  totalCount: number;
}

export function FeedbackPreviewTable({
  items,
  totalCount,
}: FeedbackPreviewTableProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        共 {totalCount} 条反馈，显示前 {items.length} 条预览
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>反馈内容</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.id}>
              <TableCell className="text-muted-foreground">
                {idx + 1}
              </TableCell>
              <TableCell className="max-w-md truncate">
                {item.raw_content}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
