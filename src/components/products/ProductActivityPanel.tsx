import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Link2,
  Download,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityItem {
  id: string;
  action: string;
  type: 'product' | 'demo' | 'apk' | 'status';
  description: string;
  timestamp: Date;
}

export function ProductActivityPanel() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate sample activities based on recent product changes
    const fetchActivities = async () => {
      setLoading(true);
      try {
        // Fetch recent products
        const { data: products } = await supabase
          .from('products')
          .select('id, name, created_at, updated_at, status')
          .order('updated_at', { ascending: false })
          .limit(5);

        // Fetch recent demos
        const { data: demos } = await supabase
          .from('demos')
          .select('id, name, created_at, product_id')
          .order('created_at', { ascending: false })
          .limit(3);

        // Fetch recent APKs
        const { data: apks } = await supabase
          .from('apks')
          .select('id, version, created_at, product_id')
          .order('created_at', { ascending: false })
          .limit(3);

        const items: ActivityItem[] = [];

        // Add product activities
        products?.forEach((p) => {
          const isNew = new Date(p.created_at).getTime() === new Date(p.updated_at).getTime();
          items.push({
            id: `product-${p.id}`,
            action: isNew ? 'created' : 'updated',
            type: 'product',
            description: `Product "${p.name}" ${isNew ? 'created' : 'updated'}`,
            timestamp: new Date(p.updated_at),
          });
        });

        // Add demo activities
        demos?.forEach((d) => {
          items.push({
            id: `demo-${d.id}`,
            action: 'added',
            type: 'demo',
            description: `Demo "${d.name}" added`,
            timestamp: new Date(d.created_at),
          });
        });

        // Add APK activities
        apks?.forEach((a) => {
          items.push({
            id: `apk-${a.id}`,
            action: 'uploaded',
            type: 'apk',
            description: `APK version ${a.version} uploaded`,
            timestamp: new Date(a.created_at),
          });
        });

        // Sort by timestamp
        items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(items.slice(0, 10));
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    // Set up real-time subscription for products
    const channel = supabase
      .channel('product-activity')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => fetchActivities()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demos' },
        () => fetchActivities()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'apks' },
        () => fetchActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getIcon = (type: ActivityItem['type'], action: string) => {
    switch (type) {
      case 'product':
        if (action === 'created') return Plus;
        if (action === 'deleted') return Trash2;
        return Edit;
      case 'demo':
        return Link2;
      case 'apk':
        return Download;
      default:
        return RefreshCw;
    }
  };

  const getIconColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'product':
        return 'text-primary bg-primary/10';
      case 'demo':
        return 'text-blue-500 bg-blue-500/10';
      case 'apk':
        return 'text-purple-500 bg-purple-500/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4 h-full">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Live Activity</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground">Live Activity</h3>
        <span className="text-xs text-muted-foreground ml-auto">Auto-refresh</span>
      </div>
      
      <ScrollArea className="h-[300px]">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = getIcon(activity.type, activity.action);
              const colorClass = getIconColor(activity.type);
              
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={cn('p-1.5 rounded-lg shrink-0', colorClass)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
