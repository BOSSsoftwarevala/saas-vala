import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  name: string;
  description?: string;
  price?: number;
  status: 'active' | 'draft' | 'archived';
  type: 'product' | 'demo' | 'apk';
  onClick?: () => void;
}

const statusStyles = {
  active: 'bg-success/20 text-success border-success/30',
  draft: 'bg-warning/20 text-warning border-warning/30',
  archived: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

const typeStyles = {
  product: 'border-l-primary',
  demo: 'border-l-cyan',
  apk: 'border-l-purple',
};

export function ProductCard({
  name,
  description,
  price,
  status,
  type,
  onClick,
}: ProductCardProps) {
  return (
    <div
      className={cn(
        'glass-card-hover min-w-[280px] max-w-[280px] rounded-xl p-4 border-l-4 cursor-pointer',
        typeStyles[type]
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h3 className="font-semibold text-foreground mb-1 truncate">{name}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Badge variant="outline" className={cn('capitalize', statusStyles[status])}>
          {status}
        </Badge>
        {price !== undefined && (
          <span className="font-semibold text-primary">
            ${price.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
