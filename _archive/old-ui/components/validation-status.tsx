"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ValidationStatusProps {
  status: "pending" | "passed" | "warning" | "failed";
  score: number;
  summary?: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
    warning_checks: number;
  };
  failedChecks?: { name: string; message: string; severity: string }[];
  warnings?: { name: string; message: string; severity: string }[];
  recommendations?: string[];
}

export function ValidationStatus({
  status,
  score,
  summary,
  failedChecks = [],
  warnings = [],
  recommendations = [],
}: ValidationStatusProps) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    pending: {
      label: "待验证",
      color: "bg-gray-100 text-gray-800",
      icon: null,
    },
    passed: {
      label: "通过",
      color: "bg-green-100 text-green-800",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    warning: {
      label: "有风险",
      color: "bg-yellow-100 text-yellow-800",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    failed: {
      label: "未通过",
      color: "bg-red-100 text-red-800",
      icon: <XCircle className="h-4 w-4" />,
    },
  };

  const config = statusConfig[status];

  return (
    <Card className={status === "failed" ? "border-red-200" : status === "warning" ? "border-yellow-200" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config.icon}
            <CardTitle className="text-sm">AI 验证状态</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={config.color}>{config.label}</Badge>
            <span className="text-sm font-mono">{score}/100</span>
          </div>
        </div>
        {summary && (
          <CardDescription>
            {summary.failed_checks > 0 && (
              <span className="text-red-600">{summary.failed_checks} 个严重问题</span>
            )}
            {summary.failed_checks > 0 && summary.warning_checks > 0 && "，"}
            {summary.warning_checks > 0 && (
              <span className="text-yellow-600">{summary.warning_checks} 个风险提示</span>
            )}
            {summary.failed_checks === 0 && summary.warning_checks === 0 && (
              <span className="text-green-600">所有检查通过</span>
            )}
          </CardDescription>
        )}
      </CardHeader>

      {(failedChecks.length > 0 || warnings.length > 0 || recommendations.length > 0) && (
        <CardContent className="pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between p-0 h-auto"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-xs text-muted-foreground">查看详情</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {expanded && (
            <div className="mt-4 space-y-4">
              {failedChecks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2">失败项</h4>
                  <ul className="space-y-1">
                    {failedChecks.map((check, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                        {check.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {warnings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-yellow-600 mb-2">风险项</h4>
                  <ul className="space-y-1">
                    {warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recommendations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">建议修复</h4>
                    <ul className="space-y-1">
                      {recommendations.map((rec, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          • {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
