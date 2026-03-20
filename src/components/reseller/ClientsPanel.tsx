import { useState, useEffect } from 'react';
import { MaskedField } from '@/components/ui/masked-field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Users, Search, Key, Calendar, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Client {
  id: string;
  name: string;
  email: string;
  keys: number;
  lastPurchase: string;
  status: string;
}

export function ClientsPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get license keys sold by this reseller, grouped by buyer
      const { data, error } = await supabase
        .from('license_keys')
        .select('id, customer_email, customer_name, status, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error || !data) {
        setClients([]);
        setLoading(false);
        return;
      }

      // Group by customer email
      const clientMap = new Map<string, Client>();
      for (const key of data) {
        const email = key.customer_email || 'unknown';
        const existing = clientMap.get(email);
        if (existing) {
          existing.keys += 1;
          if (key.created_at && key.created_at > existing.lastPurchase) {
            existing.lastPurchase = key.created_at;
          }
          if (key.status === 'active') existing.status = 'active';
        } else {
          clientMap.set(email, {
            id: key.id,
            name: key.customer_name || email.split('@')[0],
            email,
            keys: 1,
            lastPurchase: key.created_at || '',
            status: key.status || 'active',
          });
        }
      }

      setClients(Array.from(clientMap.values()));
      setLoading(false);
    };

    fetchClients();
  }, []);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const totalKeys = clients.reduce((sum, c) => sum + c.keys, 0);

  return (
    <div className="space-y-6">
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading clients...</span>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Client</TableHead>
                    <TableHead>Email</TableHead>
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
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <MaskedField value={client.email} type="email" />
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
                          {client.lastPurchase ? new Date(client.lastPurchase).toLocaleDateString() : '—'}
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
          )}

          {!loading && filteredClients.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No clients found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
