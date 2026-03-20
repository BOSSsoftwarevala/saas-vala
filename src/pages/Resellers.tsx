import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Users,
  Edit,
  Trash2,
  Ban,
  Play,
  Shield,
  Loader2,
  DollarSign,
  Percent,
  CheckCircle,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResellers, type Reseller } from '@/hooks/useResellers';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Switch } from '@/components/ui/switch';
 import { ResellerActivityPanel } from '@/components/reseller/ResellerActivityPanel';
 import { ResellerQuickActions } from '@/components/reseller/ResellerQuickActions';

const ITEMS_PER_PAGE = 25;

export default function Resellers() {
   const { resellers, loading, total, fetchResellers, updateReseller, deleteReseller } = useResellers();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editReseller, setEditReseller] = useState<Reseller | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    company_name: '',
    commission_percent: 10,
    credit_limit: 0,
    is_active: true,
    is_verified: false,
  });

  const filteredResellers = resellers.filter((reseller) => {
    const name = (reseller.company_name || '').toLowerCase();
    const profileName = (reseller.profile?.full_name || '').toLowerCase();
    const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || profileName.includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'active') return reseller.is_active;
    if (activeTab === 'suspended') return !reseller.is_active;
    if (activeTab === 'verified') return reseller.is_verified;
    return true;
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const stats = {
    total: resellers.length,
    active: resellers.filter(r => r.is_active).length,
    suspended: resellers.filter(r => !r.is_active).length,
    verified: resellers.filter(r => r.is_verified).length,
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchResellers(page, ITEMS_PER_PAGE, searchQuery);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    fetchResellers(1, ITEMS_PER_PAGE, query);
  };

  const openCreateDialog = () => {
    setEditReseller(null);
    setFormData({
      company_name: '',
      commission_percent: 10,
      credit_limit: 0,
      is_active: true,
      is_verified: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (reseller: Reseller) => {
    setEditReseller(reseller);
    setFormData({
      company_name: reseller.company_name || '',
      commission_percent: reseller.commission_percent,
      credit_limit: reseller.credit_limit,
      is_active: reseller.is_active,
      is_verified: reseller.is_verified,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editReseller) {
        await updateReseller(editReseller.id, formData);
      }
      // Note: Creating new reseller requires user_id from an existing user
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteReseller(deleteId);
    setDeleteId(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Reseller Manager
            </h2>
            <p className="text-muted-foreground">
              Manage reseller accounts, commissions, and limits
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="gap-2 border-border"
              onClick={() => window.location.assign('/reseller-dashboard')}
            >
              <Users className="h-4 w-4" />
              Reseller Dashboard
            </Button>
            <Button variant="outline" className="gap-2 border-border">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={openCreateDialog} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Add Reseller
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-primary/20 flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-success/20 flex items-center justify-center mb-2">
              <Play className="h-5 w-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{stats.active}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-destructive/20 flex items-center justify-center mb-2">
              <Ban className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive">{stats.suspended}</p>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-cyan/20 flex items-center justify-center mb-2">
              <Shield className="h-5 w-5 text-cyan" />
            </div>
            <p className="text-2xl font-bold text-cyan">{stats.verified}</p>
            <p className="text-sm text-muted-foreground">Verified</p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList className="bg-muted">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  All ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Active
                </TabsTrigger>
                <TabsTrigger value="suspended" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Suspended
                </TabsTrigger>
                <TabsTrigger value="verified" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Verified
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resellers..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>
              <Button variant="outline" size="icon" className="border-border">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

         {/* Main Grid: Table + Activity */}
         <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
           {/* Resellers Table */}
           <div className="xl:col-span-3 glass-card rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredResellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No resellers found</h3>
              <p className="text-muted-foreground mb-4">Get started by adding your first reseller</p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Reseller
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[1120px]">
                  <TableHeader>
                    <TableRow className="border-border hover:bg-muted/50">
                      <TableHead className="text-muted-foreground">Company</TableHead>
                      <TableHead className="text-muted-foreground">Commission</TableHead>
                      <TableHead className="text-muted-foreground">Credit Limit</TableHead>
                      <TableHead className="text-muted-foreground">Total Sales</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Verified</TableHead>
                      <TableHead className="text-muted-foreground">Created</TableHead>
                      <TableHead className="text-muted-foreground">Quick Actions</TableHead>
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResellers.map((reseller) => (
                      <TableRow key={reseller.id} className="border-border hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <span className="font-medium text-foreground block">{reseller.company_name || reseller.profile?.full_name || 'Unnamed'}</span>
                              {reseller.profile?.full_name && reseller.company_name !== reseller.profile.full_name && (
                                <span className="text-xs text-muted-foreground">{reseller.profile.full_name}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Percent className="h-3 w-3 text-primary" />
                            <span className="font-semibold text-primary">{reseller.commission_percent}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-foreground">₹{reseller.credit_limit.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-success">₹{reseller.total_sales.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              reseller.is_active
                                ? 'bg-success/20 text-success border-success/30'
                                : 'bg-destructive/20 text-destructive border-destructive/30'
                            )}
                          >
                            {reseller.is_active ? 'Active' : 'Suspended'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {reseller.is_verified ? (
                            <Badge variant="outline" className="bg-cyan/20 text-cyan border-cyan/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{new Date(reseller.created_at).toLocaleDateString()}</span>
                        </TableCell>
                        <TableCell>
                          <ResellerQuickActions reseller={reseller} onAction={() => fetchResellers()} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border">
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEditDialog(reseller)}>
                                <Edit className="h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={() => setDeleteId(reseller.id)}>
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={handlePageChange}
              />
            </>
             )}
           </div>
 
           {/* Activity Panel */}
           <div className="xl:col-span-1">
             <ResellerActivityPanel />
           </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editReseller ? 'Edit Reseller' : 'Add Reseller'}</DialogTitle>
            <DialogDescription>
              {editReseller ? 'Update reseller details' : 'Note: Resellers are created when users sign up'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                placeholder="Acme Corp"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commission (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.commission_percent}
                  onChange={(e) => setFormData({ ...formData, commission_percent: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Credit Limit (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-sm text-muted-foreground">Allow reseller to access system</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Verified</Label>
                <p className="text-sm text-muted-foreground">Mark as verified reseller</p>
              </div>
              <Switch
                checked={formData.is_verified}
                onCheckedChange={(checked) => setFormData({ ...formData, is_verified: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editReseller ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reseller?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the reseller account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
