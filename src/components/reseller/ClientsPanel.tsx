import { useEffect, useMemo, useState } from 'react';
 import { MaskedField } from '@/components/ui/masked-field';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi } from '@/lib/dashboardApi';
import { toast } from 'sonner';
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
  Loader2,
  Plus,
 } from 'lucide-react';

interface ResellerClientRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive' | 'blocked';
  keys: number;
  lastPurchase: string | null;
}
 
 export function ClientsPanel() {
  const { user } = useAuth();
   const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<ResellerClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingClient, setAddingClient] = useState(false);
  const [newClient, setNewClient] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  const loadClients = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await (dashboardApi as any).getResellerClients(user.id);
      setClients((data || []).map((row: any) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        status: row.status || 'active',
        keys: Number(row.keys || 0),
        lastPurchase: row.lastPurchase || null,
      })));
    } catch (error) {
      console.error('Failed to load reseller clients', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [user?.id]);

  const handleAddClient = async () => {
    if (!user?.id) return;
    const fullName = newClient.fullName.trim();
    if (!fullName) {
      toast.error('Client name is required');
      return;
    }

    setAddingClient(true);
    try {
      await (dashboardApi as any).createResellerClient(user.id, {
        fullName,
        email: newClient.email.trim() || undefined,
        phone: newClient.phone.trim() || undefined,
      });
      setNewClient({ fullName: '', email: '', phone: '' });
      toast.success('Client added');
      await loadClients();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add client');
    } finally {
      setAddingClient(false);
    }
  };
 
  const filteredClients = useMemo(() => clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      client.full_name.toLowerCase().includes(query) ||
      String(client.email || '').toLowerCase().includes(query) ||
      String(client.phone || '').toLowerCase().includes(query)
    );
  }), [clients, searchQuery]);
 
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <Input
              placeholder="Client name"
              value={newClient.fullName}
              onChange={(e) => setNewClient((prev) => ({ ...prev, fullName: e.target.value }))}
            />
            <Input
              placeholder="Email (optional)"
              value={newClient.email}
              onChange={(e) => setNewClient((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              placeholder="Phone (optional)"
              value={newClient.phone}
              onChange={(e) => setNewClient((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <Button onClick={handleAddClient} disabled={addingClient || !newClient.fullName.trim()}>
              {addingClient ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Client
            </Button>
          </div>

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
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="py-6 flex items-center justify-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading clients...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                 {filteredClients.map((client) => (
                   <TableRow key={client.id} className="hover:bg-muted/30">
                     <TableCell>
                      <div className="font-medium text-foreground">{client.full_name}</div>
                     </TableCell>
                     <TableCell>
                       <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-1 text-sm">
                             <Mail className="h-3 w-3 text-muted-foreground" />
                             {client.email ? <MaskedField value={client.email} type="email" /> : <span className="text-muted-foreground">N/A</span>}
                           </div>
                           <div className="flex items-center gap-1 text-sm">
                             <Phone className="h-3 w-3 text-muted-foreground" />
                             {client.phone ? <MaskedField value={client.phone} type="phone" /> : <span className="text-muted-foreground">N/A</span>}
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
                        {client.lastPurchase ? new Date(client.lastPurchase).toLocaleDateString() : 'No sales yet'}
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
 
          {!loading && filteredClients.length === 0 && (
             <div className="text-center py-8 text-muted-foreground">
               No clients found matching your search.
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }