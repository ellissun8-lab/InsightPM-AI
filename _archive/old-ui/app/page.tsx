import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">InsightPM AI</h1>
        <p className="text-xl text-muted-foreground">
          把混乱的用户反馈，变成产品经理敢拿去开会的机会排序报告
        </p>
        <div className="space-y-3 text-left text-muted-foreground">
          <p>上传用户反馈 CSV / TXT</p>
          <p>AI 自动清洗、分类、情绪分析</p>
          <p>问题聚类 + 机会评分 + 优先级排序</p>
          <p>一键生成产品分析报告</p>
        </div>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            开始使用
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            进入后台
          </Link>
        </div>
      </div>
    </div>
  );
}
