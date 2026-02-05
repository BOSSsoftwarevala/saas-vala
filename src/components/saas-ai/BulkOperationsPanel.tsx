 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Input } from '@/components/ui/input';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   Rocket,
   RefreshCw,
   Search,
   CheckCircle,
   XCircle,
   AlertTriangle,
   Server,
   Zap,
   RotateCcw,
 } from 'lucide-react';
 import { toast } from 'sonner';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Progress } from '@/components/ui/progress';
 
 interface Client {
   id: string;
   name: string;
   domain: string;
   status: 'online' | 'offline' | 'warning';
   version: string;
   lastDeploy: string;
   health: number;
 }
 
 const mockClients: Client[] = [
   { id: '1', name: 'TechCorp India', domain: 'techcorp.in', status: 'online', version: '2.4.1', lastDeploy: '2025-02-04', health: 98 },
   { id: '2', name: 'RetailMart', domain: 'retailmart.com', status: 'online', version: '2.4.0', lastDeploy: '2025-02-03', health: 95 },
   { id: '3', name: 'HealthPlus', domain: 'healthplus.io', status: 'warning', version: '2.3.8', lastDeploy: '2025-02-01', health: 78 },
   { id: '4', name: 'EduLearn', domain: 'edulearn.org', status: 'online', version: '2.4.1', lastDeploy: '2025-02-04', health: 100 },
   { id: '5', name: 'FinanceHub', domain: 'financehub.net', status: 'offline', version: '2.3.5', lastDeploy: '2025-01-28', health: 0 },
   { id: '6', name: 'LogiTrack', domain: 'logitrack.app', status: 'online', version: '2.4.0', lastDeploy: '2025-02-02', health: 92 },
 ];
 
 export function BulkOperationsPanel() {
   const [clients] = useState<Client[]>(mockClients);
   const [selected, setSelected] = useState<Set<string>>(new Set());
   const [search, setSearch] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);
   const [progress, setProgress] = useState(0);
   const [currentAction, setCurrentAction] = useState('');
 
   const filteredClients = clients.filter(c =>
     c.name.toLowerCase().includes(search.toLowerCase()) ||
     c.domain.toLowerCase().includes(search.toLowerCase())
   );
 
   const toggleSelect = (id: string) => {
     setSelected(prev => {
       const next = new Set(prev);
       if (next.has(id)) {
         next.delete(id);
       } else {
         next.add(id);
       }
       return next;
     });
   };
 
   const selectAll = () => {
     if (selected.size === filteredClients.length) {
       setSelected(new Set());
     } else {
       setSelected(new Set(filteredClients.map(c => c.id)));
     }
   };
 
   const executeAction = async (action: string) => {
     if (selected.size === 0) {
       toast.error('Please select at least one client');
       return;
     }
 
     setIsProcessing(true);
     setCurrentAction(action);
     setProgress(0);
 
     const total = selected.size;
     let completed = 0;
 
     for (const clientId of selected) {
       const client = clients.find(c => c.id === clientId);
       if (client) {
         await new Promise(resolve => setTimeout(resolve, 500));
         completed++;
         setProgress((completed / total) * 100);
         toast.success(`${action}: ${client.name}`, { duration: 1500 });
       }
     }
 
     setIsProcessing(false);
     setCurrentAction('');
     toast.success(`✅ ${action} completed for ${total} clients!`);
   };
 
   const getStatusBadge = (status: Client['status']) => {
     switch (status) {
       case 'online':
         return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Online</Badge>;
       case 'warning':
         return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>;
       case 'offline':
         return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Offline</Badge>;
     }
   };
 
   return (
     <div className="space-y-6">
       {/* Action Bar */}
       <Card className="glass-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Rocket className="h-5 w-5 text-primary" />
             Bulk Operations
           </CardTitle>
           <CardDescription>
             One-click deploy, update, or restart for all selected clients
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="flex flex-wrap gap-2">
             <Button
               onClick={() => executeAction('Deploy Update')}
               disabled={isProcessing || selected.size === 0}
               className="gap-2"
             >
               <Rocket className="h-4 w-4" />
               Deploy to {selected.size || 'Selected'}
             </Button>
             <Button
               variant="outline"
               onClick={() => executeAction('Restart Services')}
               disabled={isProcessing || selected.size === 0}
               className="gap-2"
             >
               <RotateCcw className="h-4 w-4" />
               Restart Services
             </Button>
             <Button
               variant="outline"
               onClick={() => executeAction('Health Check')}
               disabled={isProcessing || selected.size === 0}
               className="gap-2"
             >
               <Zap className="h-4 w-4" />
               Run Health Check
             </Button>
             <Button
               variant="outline"
               onClick={() => executeAction('Sync Database')}
               disabled={isProcessing || selected.size === 0}
               className="gap-2"
             >
               <RefreshCw className="h-4 w-4" />
               Sync Databases
             </Button>
           </div>
 
           <AnimatePresence>
             {isProcessing && (
               <motion.div
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
                 className="space-y-2"
               >
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-muted-foreground">{currentAction}...</span>
                   <span className="font-mono">{Math.round(progress)}%</span>
                 </div>
                 <Progress value={progress} className="h-2" />
               </motion.div>
             )}
           </AnimatePresence>
         </CardContent>
       </Card>
 
       {/* Client List */}
       <Card className="glass-card">
         <CardHeader>
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <div>
               <CardTitle className="flex items-center gap-2">
                 <Server className="h-5 w-5 text-primary" />
                 Client Servers ({clients.length})
               </CardTitle>
               <CardDescription>
                 {selected.size} of {clients.length} selected
               </CardDescription>
             </div>
             <div className="relative w-full sm:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder="Search clients..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="pl-9"
               />
             </div>
           </div>
         </CardHeader>
         <CardContent>
           <div className="rounded-lg border border-border overflow-hidden">
             <Table>
               <TableHeader>
                 <TableRow className="bg-muted/50">
                   <TableHead className="w-12">
                     <Checkbox
                       checked={selected.size === filteredClients.length && filteredClients.length > 0}
                       onCheckedChange={selectAll}
                     />
                   </TableHead>
                   <TableHead>Client</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Version</TableHead>
                   <TableHead>Health</TableHead>
                   <TableHead>Last Deploy</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredClients.map((client) => (
                   <TableRow
                     key={client.id}
                     className={selected.has(client.id) ? 'bg-primary/5' : 'hover:bg-muted/30'}
                   >
                     <TableCell>
                       <Checkbox
                         checked={selected.has(client.id)}
                         onCheckedChange={() => toggleSelect(client.id)}
                       />
                     </TableCell>
                     <TableCell>
                       <div>
                         <div className="font-medium">{client.name}</div>
                         <div className="text-xs text-muted-foreground">{client.domain}</div>
                       </div>
                     </TableCell>
                     <TableCell>{getStatusBadge(client.status)}</TableCell>
                     <TableCell>
                       <Badge variant="outline" className="font-mono">v{client.version}</Badge>
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-2">
                         <div className="w-16">
                           <Progress value={client.health} className="h-1.5" />
                         </div>
                         <span className="text-xs font-mono">{client.health}%</span>
                       </div>
                     </TableCell>
                     <TableCell className="text-sm text-muted-foreground">
                       {client.lastDeploy}
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
         </CardContent>
       </Card>
     </div>
   );
 }