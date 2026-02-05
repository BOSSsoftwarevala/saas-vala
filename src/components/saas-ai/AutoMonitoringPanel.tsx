 import { useState, useEffect } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Switch } from '@/components/ui/switch';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import {
   Activity,
   Bell,
   CheckCircle,
   XCircle,
   AlertTriangle,
   Globe,
   Database,
   Server,
   Cpu,
   HardDrive,
   RefreshCw,
   Settings,
 } from 'lucide-react';
 import { motion, AnimatePresence } from 'framer-motion';
 
 interface HealthMetric {
   id: string;
   name: string;
   status: 'healthy' | 'warning' | 'critical';
   value: string;
   threshold: string;
   lastCheck: Date;
   icon: typeof Server;
 }
 
 interface Alert {
   id: string;
   clientName: string;
   type: 'error' | 'warning' | 'info';
   message: string;
   timestamp: Date;
   resolved: boolean;
 }
 
 const mockMetrics: HealthMetric[] = [
   { id: '1', name: 'API Response Time', status: 'healthy', value: '45ms', threshold: '< 200ms', lastCheck: new Date(), icon: Activity },
   { id: '2', name: 'Database Connections', status: 'healthy', value: '24/100', threshold: '< 80%', lastCheck: new Date(), icon: Database },
   { id: '3', name: 'Server Uptime', status: 'healthy', value: '99.98%', threshold: '> 99.5%', lastCheck: new Date(), icon: Server },
   { id: '4', name: 'CPU Usage', status: 'warning', value: '72%', threshold: '< 70%', lastCheck: new Date(), icon: Cpu },
   { id: '5', name: 'Disk Space', status: 'healthy', value: '45GB/100GB', threshold: '< 80%', lastCheck: new Date(), icon: HardDrive },
   { id: '6', name: 'SSL Certificates', status: 'healthy', value: 'Valid', threshold: '> 7 days', lastCheck: new Date(), icon: Globe },
 ];
 
 const mockAlerts: Alert[] = [
   { id: '1', clientName: 'HealthPlus', type: 'warning', message: 'High CPU usage detected (78%)', timestamp: new Date(Date.now() - 1000 * 60 * 5), resolved: false },
   { id: '2', clientName: 'FinanceHub', type: 'error', message: 'Server unreachable - Connection timeout', timestamp: new Date(Date.now() - 1000 * 60 * 30), resolved: false },
   { id: '3', clientName: 'TechCorp', type: 'info', message: 'Scheduled maintenance completed', timestamp: new Date(Date.now() - 1000 * 60 * 60), resolved: true },
   { id: '4', clientName: 'RetailMart', type: 'warning', message: 'Database slow query detected (>2s)', timestamp: new Date(Date.now() - 1000 * 60 * 90), resolved: true },
 ];
 
 export function AutoMonitoringPanel() {
   const [metrics] = useState<HealthMetric[]>(mockMetrics);
   const [alerts] = useState<Alert[]>(mockAlerts);
   const [autoRefresh, setAutoRefresh] = useState(true);
   const [lastRefresh, setLastRefresh] = useState(new Date());
 
   // Auto-refresh simulation
   useEffect(() => {
     if (!autoRefresh) return;
     
     const interval = setInterval(() => {
       setLastRefresh(new Date());
     }, 30000);
     
     return () => clearInterval(interval);
   }, [autoRefresh]);
 
   const getStatusIcon = (status: HealthMetric['status']) => {
     switch (status) {
       case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
       case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
       case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
     }
   };
 
   const getAlertIcon = (type: Alert['type']) => {
     switch (type) {
       case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
       case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
       case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />;
     }
   };
 
   const formatTimeAgo = (date: Date) => {
     const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
     if (seconds < 60) return `${seconds}s ago`;
     if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
     if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
     return `${Math.floor(seconds / 86400)}d ago`;
   };
 
   const healthyCount = metrics.filter(m => m.status === 'healthy').length;
   const warningCount = metrics.filter(m => m.status === 'warning').length;
 
   return (
     <div className="space-y-6">
       {/* Overview Cards */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">System Health</p>
                 <p className="text-2xl font-bold text-green-500">{healthyCount}/{metrics.length}</p>
               </div>
               <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                 <CheckCircle className="h-6 w-6 text-green-500" />
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Warnings</p>
                 <p className="text-2xl font-bold text-amber-500">{warningCount}</p>
               </div>
               <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                 <AlertTriangle className="h-6 w-6 text-amber-500" />
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Active Alerts</p>
                 <p className="text-2xl font-bold text-red-500">{alerts.filter(a => !a.resolved).length}</p>
               </div>
               <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                 <Bell className="h-6 w-6 text-red-500" />
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Last Check</p>
                 <p className="text-lg font-bold">{formatTimeAgo(lastRefresh)}</p>
               </div>
               <div className="flex items-center gap-2">
                 <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                 <span className="text-xs text-muted-foreground">Auto</span>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Health Metrics */}
         <Card className="glass-card">
           <CardHeader>
             <div className="flex items-center justify-between">
               <div>
                 <CardTitle className="flex items-center gap-2">
                   <Activity className="h-5 w-5 text-primary" />
                   Health Metrics
                 </CardTitle>
                 <CardDescription>Real-time system monitoring</CardDescription>
               </div>
               <Button variant="ghost" size="icon" onClick={() => setLastRefresh(new Date())}>
                 <RefreshCw className="h-4 w-4" />
               </Button>
             </div>
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
               {metrics.map((metric) => (
                 <motion.div
                   key={metric.id}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                 >
                   <div className="flex items-center gap-3">
                     <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                       metric.status === 'healthy' ? 'bg-green-500/20' :
                       metric.status === 'warning' ? 'bg-amber-500/20' :
                       'bg-red-500/20'
                     }`}>
                       <metric.icon className={`h-4 w-4 ${
                         metric.status === 'healthy' ? 'text-green-500' :
                         metric.status === 'warning' ? 'text-amber-500' :
                         'text-red-500'
                       }`} />
                     </div>
                     <div>
                       <p className="text-sm font-medium">{metric.name}</p>
                       <p className="text-xs text-muted-foreground">Threshold: {metric.threshold}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-sm font-mono">{metric.value}</span>
                     {getStatusIcon(metric.status)}
                   </div>
                 </motion.div>
               ))}
             </div>
           </CardContent>
         </Card>
 
         {/* Alerts */}
         <Card className="glass-card">
           <CardHeader>
             <div className="flex items-center justify-between">
               <div>
                 <CardTitle className="flex items-center gap-2">
                   <Bell className="h-5 w-5 text-primary" />
                   Recent Alerts
                 </CardTitle>
                 <CardDescription>System notifications and warnings</CardDescription>
               </div>
               <Button variant="ghost" size="sm">
                 <Settings className="h-4 w-4 mr-2" />
                 Configure
               </Button>
             </div>
           </CardHeader>
           <CardContent>
             <ScrollArea className="h-[300px]">
               <div className="space-y-3">
                 <AnimatePresence>
                   {alerts.map((alert) => (
                     <motion.div
                       key={alert.id}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, x: -10 }}
                       className={`p-3 rounded-lg border ${
                         alert.resolved 
                           ? 'bg-muted/20 border-border opacity-60'
                           : alert.type === 'error'
                             ? 'bg-red-500/5 border-red-500/20'
                             : alert.type === 'warning'
                               ? 'bg-amber-500/5 border-amber-500/20'
                               : 'bg-blue-500/5 border-blue-500/20'
                       }`}
                     >
                       <div className="flex items-start gap-3">
                         {getAlertIcon(alert.type)}
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center justify-between gap-2">
                             <span className="text-sm font-medium">{alert.clientName}</span>
                             <div className="flex items-center gap-2">
                               {alert.resolved && (
                                 <Badge variant="outline" className="text-[10px]">Resolved</Badge>
                               )}
                               <span className="text-xs text-muted-foreground">
                                 {formatTimeAgo(alert.timestamp)}
                               </span>
                             </div>
                           </div>
                           <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                         </div>
                       </div>
                     </motion.div>
                   ))}
                 </AnimatePresence>
               </div>
             </ScrollArea>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }