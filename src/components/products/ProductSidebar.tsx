import { cn } from '@/lib/utils';
import {
  Package,
  FolderTree,
  Layers,
  Layers2,
  Layers3,
  Link2,
  Download,
  Key,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

export type ProductView =
  | 'products'
  | 'master'
  | 'sub'
  | 'micro'
  | 'nano'
  | 'demos'
  | 'apks'
  | 'licenses';

interface ProductSidebarProps {
  activeView: ProductView;
  onViewChange: (view: ProductView) => void;
}

interface NavItem {
  id: ProductView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { id: 'products', label: 'Product List', icon: Package },
  {
    id: 'master',
    label: 'Categories',
    icon: FolderTree,
    children: [
      { id: 'master', label: 'Master Categories', icon: FolderTree },
      { id: 'sub', label: 'Sub Categories', icon: Layers },
      { id: 'micro', label: 'Micro Categories', icon: Layers2 },
      { id: 'nano', label: 'Nano Categories', icon: Layers3 },
    ],
  },
  { id: 'demos', label: 'Demo Mapping', icon: Link2 },
  { id: 'apks', label: 'APK Mapping', icon: Download },
  { id: 'licenses', label: 'License Mapping', icon: Key },
];

export function ProductSidebar({ activeView, onViewChange }: ProductSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState(true);

  const isActiveCategory = ['master', 'sub', 'micro', 'nano'].includes(activeView);

  return (
    <aside className="w-56 shrink-0 hidden lg:block">
      <div className="glass-card rounded-xl p-3 sticky top-20">
        <div className="space-y-1">
          {navItems.map((item) => {
            if (item.children) {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => setExpandedCategories(!expandedCategories)}
                    className={cn(
                      'flex items-center justify-between w-full gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isActiveCategory
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    {expandedCategories ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedCategories && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                      {item.children.map((child) => {
                        const Icon = child.icon;
                        const isActive = activeView === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => onViewChange(child.id)}
                            className={cn(
                              'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-all duration-200',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="text-xs">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
