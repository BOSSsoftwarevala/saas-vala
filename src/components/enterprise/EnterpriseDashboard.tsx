import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Package, 
  Key, 
  Activity, 
  Settings, 
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useDashboardStats, useUserPermissions } from '@/lib/enterprise/realApi';
import { useRealtimeMetrics } from '@/lib/enterprise/realAnalytics';

interface EnterpriseDashboardProps {
  userId: string;
}

export function EnterpriseDashboard({ userId }: EnterpriseDashboardProps) {
  const { stats, loading: statsLoading, error: statsError } = useDashboardStats(userId);
  const { permissions, loading: permsLoading } = useUserPermissions(userId);
  const { metrics: realtimeMetrics, loading: metricsLoading } = useRealtimeMetrics();
  const [activeTab, setActiveTab] = useState('overview');

  if (statsLoading || permsLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="text-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold">Error loading dashboard</h3>
        <p className="text-muted-foreground">{statsError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enterprise Dashboard</h1>
          <p className="text-muted-foreground">System overview and management</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={realtimeMetrics.errorRate < 5 ? 'default' : 'destructive'}>
            {realtimeMetrics.errorRate < 5 ? 'Healthy' : 'Warning'}
          </Badge>
          <Badge variant="outline">
            {realtimeMetrics.activeUsers} Active Users
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Real-time Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realtimeMetrics.activeUsers}</div>
                <p className="text-xs text-muted-foreground">Last 5 minutes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Requests/min</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realtimeMetrics.requestsPerMinute}</div>
                <p className="text-xs text-muted-foreground">Current rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realtimeMetrics.errorRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Last 5 minutes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realtimeMetrics.avgResponseTime}ms</div>
                <p className="text-xs text-muted-foreground">Average</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Stats */}
          {stats?.dailyStats && stats.dailyStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Last 7 days overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.dailyStats.reduce((sum: number, day: any) => sum + day.productViews, 0)}
                    </div>
                    <p className="text-sm text-muted-foreground">Product Views</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.dailyStats.reduce((sum: number, day: any) => sum + day.keyGenerations, 0)}
                    </div>
                    <p className="text-sm text-muted-foreground">API Keys Generated</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.dailyStats.reduce((sum: number, day: any) => sum + day.serverDeploys, 0)}
                    </div>
                    <p className="text-sm text-muted-foreground">Deployments</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.dailyStats.reduce((sum: number, day: any) => sum + day.userRegistrations, 0)}
                    </div>
                    <p className="text-sm text-muted-foreground">New Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Products */}
          {stats?.topProducts && stats.topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
                <CardDescription>Most viewed products this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.topProducts.map((product: any, index: number) => (
                    <div key={product.productId} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{product.productName}</p>
                          <p className="text-sm text-muted-foreground">{product.totalViews} views</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{product.deployments} deploys</p>
                        <p className="text-sm text-muted-foreground">{product.revenue} revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Product Management</h2>
            {permissions?.canCreateProduct && (
              <Button>
                <Package className="h-4 w-4 mr-2" />
                Create Product
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Product Operations</CardTitle>
              <CardDescription>Manage your products and deployments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {permissions?.canCreateProduct && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Create New Product</h4>
                    <p className="text-sm text-muted-foreground">Add a new product to your catalog</p>
                  </div>
                  <Button>Create Product</Button>
                </div>
              )}
              
              {permissions?.canDeployServer && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Deploy Server</h4>
                    <p className="text-sm text-muted-foreground">Deploy product to server</p>
                  </div>
                  <Button>Deploy</Button>
                </div>
              )}

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">View Products</h4>
                  <p className="text-sm text-muted-foreground">Browse all products</p>
                </div>
                <Button variant="outline">View All</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">User Management</h2>
            {permissions?.canManageUsers && (
              <Button>
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Operations</CardTitle>
              <CardDescription>Manage users and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {permissions?.canManageUsers && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Assign Roles</h4>
                    <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
                  </div>
                  <Button>Manage Roles</Button>
                </div>
              )}

              {permissions?.canViewLogs && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">View User Activity</h4>
                    <p className="text-sm text-muted-foreground">Monitor user actions</p>
                  </div>
                  <Button variant="outline">View Activity</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">System Management</h2>
            {permissions?.canManageSystem && (
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                System Settings
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Monitor system status and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Database</p>
                    <p className="text-sm text-muted-foreground">Connected and operational</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">API Server</p>
                    <p className="text-sm text-muted-foreground">Running normally</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Job Queue</p>
                    <p className="text-sm text-muted-foreground">Processing jobs</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Cache</p>
                    <p className="text-sm text-muted-foreground">Operational</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {permissions?.canManageSystem && (
            <Card>
              <CardHeader>
                <CardTitle>System Operations</CardTitle>
                <CardDescription>Administrative system tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Feature Flags</h4>
                    <p className="text-sm text-muted-foreground">Manage feature toggles</p>
                  </div>
                  <Button variant="outline">Manage Flags</Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Maintenance Mode</h4>
                    <p className="text-sm text-muted-foreground">Schedule maintenance</p>
                  </div>
                  <Button variant="outline">Schedule</Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Job Queue</h4>
                    <p className="text-sm text-muted-foreground">Monitor background jobs</p>
                  </div>
                  <Button variant="outline">View Jobs</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Analytics</h2>
            {permissions?.canViewAnalytics && (
              <Button>
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Analytics Overview</CardTitle>
              <CardDescription>System and business metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {permissions?.canViewAnalytics ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Analytics Dashboard</h3>
                  <p className="text-muted-foreground mb-4">
                    Detailed analytics and reporting features
                  </p>
                  <div className="flex justify-center space-x-2">
                    <Button>View Reports</Button>
                    <Button variant="outline">Export Data</Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
                  <p className="text-muted-foreground">
                    You don't have permission to view analytics
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EnterpriseDashboard;
