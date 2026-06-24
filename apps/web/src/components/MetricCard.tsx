interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  accent?: boolean;
}

export default function MetricCard({
  label,
  value,
  sub,
  icon,
  accent,
}: MetricCardProps) {
  return (
    <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
      <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className={`text-headline-md font-headline-md ${
          accent ? "text-tertiary-container" : "text-on-surface"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-label-md text-on-surface-variant mt-1">{sub}</div>
      )}
    </div>
  );
}
