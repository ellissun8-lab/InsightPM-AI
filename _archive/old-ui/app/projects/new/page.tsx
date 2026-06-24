"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const projectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空"),
  product_type: z.string().optional(),
  business_goal: z.string().optional(),
  target_user: z.string().optional(),
  key_metric: z.string().optional(),
  description: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const businessGoals = [
  "提升增长",
  "提升激活",
  "提升留存",
  "提升转化",
  "提升续费",
  "降低成本",
  "改善体验",
  "探索机会",
];

export default function NewProjectPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  });

  const onSubmit = async (data: ProjectFormData) => {
    setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "创建失败");
      }

      const result = await response.json();
      toast.success("项目创建成功");
      router.push(`/projects/${result.id}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "创建失败，请重试";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>创建新项目</CardTitle>
            <CardDescription>
              填写产品基本信息，开始分析用户反馈
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">产品名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：SaaS 报表系统"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_type">产品类型</Label>
                <Input
                  id="product_type"
                  placeholder="例如：B端 SaaS、C端 App、电商"
                  {...register("product_type")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_goal">当前业务目标</Label>
                <Select
                  onValueChange={(value: string | null) => {
                    if (value) setValue("business_goal", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择业务目标" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessGoals.map((goal) => (
                      <SelectItem key={goal} value={goal}>
                        {goal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_user">目标用户</Label>
                <Input
                  id="target_user"
                  placeholder="例如：企业客户管理员"
                  {...register("target_user")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key_metric">关键指标</Label>
                <Input
                  id="key_metric"
                  placeholder="例如：续费率、DAU、转化率"
                  {...register("key_metric")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">产品描述</Label>
                <Textarea
                  id="description"
                  placeholder="简要描述你的产品..."
                  rows={3}
                  {...register("description")}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "创建中..." : "创建项目"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
