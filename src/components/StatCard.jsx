export default function StatCard({ label, value, sublabel, icon: Icon, accent }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent || 'bg-primary/10 text-primary'}`}>
            <Icon size={16} className="dark:brightness-150" />
          </div>
        )}
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground">
        {value}
      </div>
      {sublabel && (
        <div className="text-xs text-muted-foreground mt-1.5">{sublabel}</div>
      )}
    </div>
  );
}