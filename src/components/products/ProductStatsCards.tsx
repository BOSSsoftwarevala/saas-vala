import { Package, CheckCircle, Ban, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductStatsCardsProps {
  totalProducts: number;
  activeProducts: number;
  suspendedProducts: number;
  totalCategories: number;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

interface StatCard {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  filter: string | null;
  colorClass: string;
}

export function ProductStatsCards({
  totalProducts,
  activeProducts,
  suspendedProducts,
  totalCategories,
  activeFilter,
  onFilterChange,
}: ProductStatsCardsProps) {
  const stats: StatCard[] = [
    {
      title: 'Total Products',
      value: totalProducts,
      icon: Package,
      filter: null,
      colorClass: 'text-primary',
    },
    {
      title: 'Active Products',
      value: activeProducts,
      icon: CheckCircle,
      filter: 'active',
      colorClass: 'text-success',
    },
    {
      title: 'Suspended Products',
      value: suspendedProducts,
      icon: Ban,
      filter: 'suspended',
      colorClass: 'text-destructive',
    },
    {
      title: 'Total Categories',
      value: totalCategories,
      icon: FolderTree,
      filter: 'categories',
      colorClass: 'text-warning',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isActive = activeFilter === stat.filter;

        return (
          <button
            key={stat.title}
            onClick={() => onFilterChange(stat.filter === activeFilter ? null : stat.filter)}
            className={cn(
              'glass-card rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02]',
              isActive && 'ring-2 ring-primary'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className={cn('text-2xl font-bold mt-1', stat.colorClass)}>
                  {stat.value}
                </p>
              </div>
              <div className={cn('p-3 rounded-lg bg-muted', stat.colorClass)}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
