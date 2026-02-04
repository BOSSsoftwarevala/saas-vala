import {
  Package,
  CheckCircle,
  FileText,
  Ban,
  Link2,
  PlayCircle,
  Download,
  AlertTriangle,
  FolderTree,
  Key,
  Server,
  HeartPulse,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductView } from './ProductSidebar';

interface ProductKPIGridProps {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  suspendedProducts: number;
  totalDemos: number;
  activeDemos: number;
  totalApks: number;
  outdatedApks: number;
  categoryCoverage: number;
  licensesLinked: number;
  licensesMissing: number;
  serversConnected: number;
  serversMissing: number;
  healthOk: number;
  healthWarning: number;
  healthError: number;
  onAction: (action: string) => void;
  onViewChange: (view: ProductView) => void;
}

interface KPIBox {
  id: string;
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  actionLabel: string;
  colorClass: string;
  bgClass: string;
}

export function ProductKPIGrid({
  totalProducts,
  activeProducts,
  draftProducts,
  suspendedProducts,
  totalDemos,
  activeDemos,
  totalApks,
  outdatedApks,
  categoryCoverage,
  licensesLinked,
  licensesMissing,
  serversConnected,
  serversMissing,
  healthOk,
  healthWarning,
  healthError,
  onAction,
  onViewChange,
}: ProductKPIGridProps) {
  const kpiBoxes: KPIBox[] = [
    {
      id: 'total',
      title: 'Total Products',
      value: totalProducts,
      icon: Package,
      action: 'view_all',
      actionLabel: 'View All',
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      id: 'active',
      title: 'Active Products',
      value: activeProducts,
      icon: CheckCircle,
      action: 'view_active',
      actionLabel: 'View Active',
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
    },
    {
      id: 'draft',
      title: 'Draft Products',
      value: draftProducts,
      icon: FileText,
      action: 'continue_setup',
      actionLabel: 'Continue Setup',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
    },
    {
      id: 'suspended',
      title: 'Suspended Products',
      value: suspendedProducts,
      icon: Ban,
      action: 'review_restore',
      actionLabel: 'Review / Restore',
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
    },
    {
      id: 'demos_total',
      title: 'Total Demos',
      value: totalDemos,
      icon: Link2,
      action: 'manage_demos',
      actionLabel: 'Manage Demos',
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-500/10',
    },
    {
      id: 'demos_active',
      title: 'Active Demos',
      value: activeDemos,
      icon: PlayCircle,
      action: 'open_demos',
      actionLabel: 'Open Demos',
      colorClass: 'text-cyan-500',
      bgClass: 'bg-cyan-500/10',
    },
    {
      id: 'apks',
      title: 'APK Count',
      value: totalApks,
      icon: Download,
      action: 'manage_apks',
      actionLabel: 'Manage APKs',
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-500/10',
    },
    {
      id: 'apk_issues',
      title: 'APK Version Issues',
      value: outdatedApks,
      icon: AlertTriangle,
      action: 'fix_apks',
      actionLabel: 'Fix Now',
      colorClass: outdatedApks > 0 ? 'text-destructive' : 'text-success',
      bgClass: outdatedApks > 0 ? 'bg-destructive/10' : 'bg-success/10',
    },
    {
      id: 'categories',
      title: 'Category Coverage',
      value: `${categoryCoverage}%`,
      icon: FolderTree,
      action: 'view_tree',
      actionLabel: 'View Tree',
      colorClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10',
    },
    {
      id: 'licenses',
      title: 'License Link Status',
      value: licensesLinked,
      subValue: `${licensesMissing} missing`,
      icon: Key,
      action: 'fix_license',
      actionLabel: 'Fix Link',
      colorClass: licensesMissing > 0 ? 'text-warning' : 'text-success',
      bgClass: licensesMissing > 0 ? 'bg-warning/10' : 'bg-success/10',
    },
    {
      id: 'servers',
      title: 'Server Link Status',
      value: serversConnected,
      subValue: `${serversMissing} missing`,
      icon: Server,
      action: 'assign_server',
      actionLabel: 'Assign Server',
      colorClass: serversMissing > 0 ? 'text-warning' : 'text-success',
      bgClass: serversMissing > 0 ? 'bg-warning/10' : 'bg-success/10',
    },
    {
      id: 'health',
      title: 'Product Health',
      value: healthOk,
      subValue: healthWarning > 0 || healthError > 0 
        ? `${healthWarning} warn / ${healthError} error` 
        : 'All OK',
      icon: HeartPulse,
      action: 'health_check',
      actionLabel: 'Health Check',
      colorClass: healthError > 0 ? 'text-destructive' : healthWarning > 0 ? 'text-warning' : 'text-success',
      bgClass: healthError > 0 ? 'bg-destructive/10' : healthWarning > 0 ? 'bg-warning/10' : 'bg-success/10',
    },
  ];

  const handleAction = (box: KPIBox) => {
    switch (box.action) {
      case 'manage_demos':
        onViewChange('demos');
        break;
      case 'open_demos':
        onViewChange('demos');
        break;
      case 'manage_apks':
        onViewChange('apks');
        break;
      case 'fix_apks':
        onViewChange('apks');
        break;
      case 'view_tree':
        onViewChange('master');
        break;
      case 'fix_license':
        onViewChange('licenses');
        break;
      default:
        onAction(box.action);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {kpiBoxes.map((box) => {
        const Icon = box.icon;
        return (
          <button
            key={box.id}
            onClick={() => handleAction(box)}
            className={cn(
              'glass-card rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02] group',
              'hover:ring-2 hover:ring-primary/50'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{box.title}</p>
                <p className={cn('text-2xl font-bold mt-1', box.colorClass)}>
                  {box.value}
                </p>
                {box.subValue && (
                  <p className="text-xs text-muted-foreground mt-0.5">{box.subValue}</p>
                )}
              </div>
              <div className={cn('p-2 rounded-lg shrink-0', box.bgClass)}>
                <Icon className={cn('h-4 w-4', box.colorClass)} />
              </div>
            </div>
            <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {box.actionLabel} →
            </p>
          </button>
        );
      })}
    </div>
  );
}
