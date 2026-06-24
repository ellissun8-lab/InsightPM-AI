"use client";

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <div className="flex items-start justify-between mb-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-sm">{actions}</div>}
    </div>
  );
}
