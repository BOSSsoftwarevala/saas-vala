import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Cpu, MoreVertical, Copy, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAiApiKeys } from '@/hooks/useAiApiKeys';

export default function AiApis() {
  const { apiKeys, loading, getUsageStats } = useAiApiKeys();
  const [searchQuery, setSearchQuery] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const stats = getUsageStats();

  const filteredKeys = apiKeys.filter((key) =>
    key.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getUsageColor = (current: number, limit: number) => {
    const percentage = (current / limit) * 100;
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              AI API Manager
            </h2>
            <p className="text-muted-foreground">
              Monitor your AI API usage and manage keys
            </p>
          </div>
          <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
            <Plus className="h-4 w-4" />
            Create API Key
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalKeys}</p>
            <p className="text-sm text-muted-foreground">Total Sessions</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.activeKeys}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.totalRequests.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Tokens</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warning">${stats.totalCost.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Est. Cost</p>
          </div>
        </div>

        {/* Search */}
        <div className="glass-card rounded-xl p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search API usage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
        </div>

        {/* API Key Cards */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Cpu className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-display text-lg font-bold text-foreground mb-2">
              No AI Usage Found
            </h3>
            <p className="text-muted-foreground mb-4">
              Start using the AI Chat to see your usage statistics here
            </p>
            <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Go to AI Chat
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredKeys.map((apiKey) => (
              <Card key={apiKey.id} className="glass-card-hover overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Cpu className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-foreground">{apiKey.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Last used: {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={apiKey.enabled} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* API Key Display */}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <code className="flex-1 text-sm font-mono text-foreground">
                      {showKeys[apiKey.id] ? apiKey.api_key : apiKey.api_key.replace(/./g, '•').slice(0, 20)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                    >
                      {showKeys[apiKey.id] ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(apiKey.api_key)}
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>

                  {/* Usage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Token Usage</span>
                      <span className="text-foreground font-medium">
                        {apiKey.current_usage.toLocaleString()} / {apiKey.usage_limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress
                      value={(apiKey.current_usage / apiKey.usage_limit) * 100}
                      className={cn('h-2', getUsageColor(apiKey.current_usage, apiKey.usage_limit))}
                    />
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        apiKey.enabled
                          ? 'bg-success/20 text-success border-success/30'
                          : 'bg-muted text-muted-foreground border-muted-foreground/30'
                      )}
                    >
                      {apiKey.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    {apiKey.current_usage / apiKey.usage_limit >= 0.9 && (
                      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                        Near Limit
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
