import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  product_type: string | null;
  business_goal: string | null;
  created_at: string;
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <CardTitle className="text-lg">{project.name}</CardTitle>
          {project.product_type && (
            <CardDescription>{project.product_type}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {project.business_goal && (
              <Badge variant="secondary">{project.business_goal}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(project.created_at).toLocaleDateString("zh-CN")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
