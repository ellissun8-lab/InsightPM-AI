"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/loading-state";
import {
  calculateConfidenceLevel,
  CONFIDENCE_LABELS,
  CONFIDENCE_COLORS,
  getSuggestedActionLabel,
} from "@/lib/config/product-analysis-context";

interface IssueCluster {
  id: string;
  name: string;
  summary: string;
  feedback_count: number;
  sentiment_score: number | null;
  frequency_score: number | null;
  user_value_score: number | null;
  business_value_score: number | null;
  strategic_fit_score: number | null;
  complexity_score: number | null;
  evidence_score: number | null;
  opportunity_score: number | null;
  priority: string | null;
  recommendation: string | null;
  suggested_action: string | null;
  possible_metrics: string[] | null;
  evidence_feedback_ids: string[] | null;
  risk_notes: string | null;
  missing_evidence: string | null;
  product_type?: string | null;
}

interface FeedbackItem {
  id: string;
  raw_content: string;
  ai_summary: string | null;
  sentiment: string | null;
  feedback_type: string | null;
}

export function IssueClusterDetail({
  cluster,
}: {
  cluster: IssueCluster;
}) {
  const [open, setOpen] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && cluster.evidence_feedback_ids && cluster.evidence_feedback_ids.length > 0) {
      fetchFeedbackItems();
    }
  }, [open, cluster.evidence_feedback_ids]);

  const fetchFeedbackItems = async () => {
    setLoading(true);
    try {
      const ids = cluster.evidence_feedback_ids?.join(",") || "";
      const res = await fetch(`/api/feedback-items?ids=${ids}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbackItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch feedback items:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        查看
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cluster.name}</DialogTitle>
          <DialogDescription>{cluster.summary}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scores */}
          <div>
            <h4 className="text-sm font-medium mb-2">评分详情</h4>
            <div className="grid grid-cols-3 gap-2">
              <ScoreCard label="机会分" value={cluster.opportunity_score} highlight />
              <ScoreCard label="优先级" badge={cluster.priority} />
              <ScoreCard label="反馈数" value={cluster.feedback_count} />
              <ScoreCard label="情绪分" value={cluster.sentiment_score} />
              <ScoreCard label="置信度" badge={CONFIDENCE_LABELS[calculateConfidenceLevel(cluster.feedback_count, cluster.evidence_feedback_ids?.length || 0, cluster.product_type)]} badgeColor={CONFIDENCE_COLORS[calculateConfidenceLevel(cluster.feedback_count, cluster.evidence_feedback_ids?.length || 0, cluster.product_type)]} />
              <ScoreCard label="用户价值" value={cluster.user_value_score} />
              <ScoreCard label="商业价值" value={cluster.business_value_score} />
              <ScoreCard label="战略匹配" value={cluster.strategic_fit_score} />
              <ScoreCard label="复杂度" value={cluster.complexity_score} />
            </div>
          </div>

          <Separator />

          {/* Recommendation */}
          {cluster.recommendation && (
            <div>
              <h4 className="text-sm font-medium mb-1">建议</h4>
              <p className="text-sm text-muted-foreground">
                {cluster.recommendation}
              </p>
            </div>
          )}

          {/* Suggested Action */}
          {cluster.suggested_action && (
            <div>
              <h4 className="text-sm font-medium mb-1">建议动作</h4>
              <Badge variant="outline">
                {getSuggestedActionLabel(cluster.suggested_action)}
              </Badge>
            </div>
          )}

          <Separator />

          {/* Metrics */}
          {cluster.possible_metrics && cluster.possible_metrics.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">可能影响的指标</h4>
              <div className="flex flex-wrap gap-1">
                {cluster.possible_metrics.map((metric, i) => (
                  <Badge key={i} variant="secondary">
                    {metric}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Risk Notes */}
          {cluster.risk_notes && (
            <div>
              <h4 className="text-sm font-medium mb-1">风险说明</h4>
              <p className="text-sm text-muted-foreground">
                {cluster.risk_notes}
              </p>
            </div>
          )}

          {/* Missing Evidence */}
          {cluster.missing_evidence && (
            <div>
              <h4 className="text-sm font-medium mb-1">缺少的证据</h4>
              <p className="text-sm text-muted-foreground">
                {cluster.missing_evidence}
              </p>
            </div>
          )}

          <Separator />

          {/* Evidence Feedback */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              原始反馈证据 ({cluster.evidence_feedback_ids?.length || 0} 条)
            </h4>
            {loading ? (
              <LoadingState message="加载反馈证据..." />
            ) : feedbackItems.length > 0 ? (
              <div className="space-y-2">
                {feedbackItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="pt-4">
                      <p className="text-sm">{item.raw_content}</p>
                      <div className="flex gap-2 mt-2">
                        {item.sentiment && (
                          <Badge variant="secondary" className="text-xs">
                            {item.sentiment === "positive"
                              ? "正面"
                              : item.sentiment === "negative"
                              ? "负面"
                              : item.sentiment === "strong_negative"
                              ? "强烈负面"
                              : "中性"}
                          </Badge>
                        )}
                        {item.feedback_type && (
                          <Badge variant="outline" className="text-xs">
                            {item.feedback_type}
                          </Badge>
                        )}
                      </div>
                      {item.ai_summary && (
                        <p className="text-xs text-muted-foreground mt-1">
                          摘要: {item.ai_summary}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                暂无反馈证据数据
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoreCard({
  label,
  value,
  badge,
  badgeColor,
  highlight,
}: {
  label: string;
  value?: number | null;
  badge?: string | null;
  badgeColor?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center p-2 rounded ${highlight ? "bg-primary/10" : "bg-muted"}`}>
      <span className="text-xs">{label}</span>
      {badge ? (
        <Badge variant={badge === "P0" ? "destructive" : "secondary"} className={`text-xs ${badgeColor || ""}`}>
          {badge}
        </Badge>
      ) : (
        <span className={`font-mono text-sm ${highlight ? "font-bold" : ""}`}>
          {value ?? "-"}
        </span>
      )}
    </div>
  );
}
