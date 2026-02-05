 import { useState } from 'react';
 import { MaskedField } from '@/components/ui/masked-field';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   Users,
   Search,
   Key,
   Calendar,
   Mail,
   Phone,
 } from 'lucide-react';
 
 // Mock client data
 const mockClients = [
   { id: 1, name: 'Rajesh Kumar', email: 'rajesh@example.com', phone: '+91 98765 43210', keys: 5, lastPurchase: '2024-01-15', status: 'active' },
   { id: 2, name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 87654 32109', keys: 3, lastPurchase: '2024-01-10', status: 'active' },
   { id: 3, name: 'Amit Patel', email: 'amit@example.com', phone: '+91 76543 21098', keys: 8, lastPurchase: '2024-01-08', status: 'active' },
   { id: 4, name: 'Sunita Verma', email: 'sunita@example.com', phone: '+91 65432 10987', keys: 2, lastPurchase: '2024-01-05', status: 'inactive' },
   { id: 5, name: 'Vikram Singh', email: 'vikram@example.com', phone: '+91 54321 09876', keys: 12, lastPurchase: '2024-01-02', status: 'active' },
 ];
 
 export function ClientsPanel() {
   const [searchQuery, setSearchQuery] = useState('');
   const [clients] = useState(mockClients);
 
   const filteredClients = clients.filter(client =>
     client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     client.email.toLowerCase().includes(searchQuery.toLowerCase())
   );
 
   const totalClients = clients.length;
   const activeClients = clients.filter(c => c.status === 'active').length;
   const totalKeys = clients.reduce((sum, c) => sum + c.keys, 0);
 
   return (
     <div className="space-y-6">
       {/* Stats */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                 <Users className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Total Clients</p>
                 <p className="text-xl font-bold text-foreground">{totalClients}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                 <Users className="h-5 w-5 text-green-500" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Active Clients</p>
                 <p className="text-xl font-bold text-foreground">{activeClients}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                 <Key className="h-5 w-5 text-secondary" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Total Keys Sold</p>
                 <p className="text-xl font-bold text-foreground">{totalKeys}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Client List */}
       <Card className="glass-card">
         <CardHeader>
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <div>
               <CardTitle className="flex items-center gap-2">
                 <Users className="h-5 w-5 text-primary" />
                 My Clients
               </CardTitle>
               <CardDescription>
                 View and track your client purchases
               </CardDescription>
             </div>
             <div className="relative w-full sm:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder="Search clients..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
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
                   <TableHead>Client</TableHead>
                   <TableHead>Contact</TableHead>
                   <TableHead className="text-center">Keys</TableHead>
                   <TableHead>Last Purchase</TableHead>
                   <TableHead>Status</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredClients.map((client) => (
                   <TableRow key={client.id} className="hover:bg-muted/30">
                     <TableCell>
                       <div className="font-medium text-foreground">{client.name}</div>
                     </TableCell>
                     <TableCell>
                       <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-1 text-sm">
                             <Mail className="h-3 w-3 text-muted-foreground" />
                             <MaskedField value={client.email} type="email" />
                           </div>
                           <div className="flex items-center gap-1 text-sm">
                             <Phone className="h-3 w-3 text-muted-foreground" />
                             <MaskedField value={client.phone} type="phone" />
                           </div>
                       </div>
                     </TableCell>
                     <TableCell className="text-center">
                       <Badge variant="outline" className="font-mono">
                         {client.keys}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-1 text-sm text-muted-foreground">
                         <Calendar className="h-3 w-3" />
                         {client.lastPurchase}
                       </div>
                     </TableCell>
                     <TableCell>
                       <Badge
                         variant="outline"
                         className={client.status === 'active' 
                           ? 'bg-green-500/20 text-green-500 border-green-500/30'
                           : 'bg-muted text-muted-foreground border-muted-foreground/30'
                         }
                       >
                         {client.status}
                       </Badge>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
 
           {filteredClients.length === 0 && (
             <div className="text-center py-8 text-muted-foreground">
               No clients found matching your search.
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }