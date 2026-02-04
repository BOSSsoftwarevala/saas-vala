import { cn } from '@/lib/utils';
import {
  FolderTree,
  Layers,
  Layers2,
  Layers3,
  Package,
  Link2,
  Download,
  Key,
} from 'lucide-react';

export type ProductView =
  | 'products'
  | 'master'
  | 'sub'
  | 'micro'
  | 'nano'
  | 'demos'
  | 'apks'
  | 'licenses';

interface ProductSubNavProps {
  activeView: ProductView;
  onViewChange: (view: ProductView) => void;
}

interface NavItem {
  id: ProductView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'products', label: 'Product List', icon: Package },
  { id: 'master', label: 'Master Categories', icon: FolderTree },
  { id: 'sub', label: 'Sub Categories', icon: Layers },
  { id: 'micro', label: 'Micro Categories', icon: Layers2 },
  { id: 'nano', label: 'Nano Categories', icon: Layers3 },
  { id: 'demos', label: 'Demo Mapping', icon: Link2 },
  { id: 'apks', label: 'APK Mapping', icon: Download },
  { id: 'licenses', label: 'License Mapping', icon: Key },
];

export function ProductSubNav({ activeView, onViewChange }: ProductSubNavProps) {
  return (
    <div className="glass-card rounded-xl p-2">
      <div className="flex flex-wrap gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
