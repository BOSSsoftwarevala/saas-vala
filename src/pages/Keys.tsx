 import { useState, useMemo } from 'react';
 import { DashboardLayout } from '@/components/layout/DashboardLayout';
 import { Button } from '@/components/ui/button';
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
 import { Key, Plus } from 'lucide-react';
 import { useLicenseKeys, type LicenseKey } from '@/hooks/useLicenseKeys';
 import { useProducts } from '@/hooks/useProducts';
 import { KeyStatsCards } from '@/components/keys/KeyStatsCards';
 import { KeyFilterRow } from '@/components/keys/KeyFilterRow';
 import { KeyGeneratorForm } from '@/components/keys/KeyGeneratorForm';
 import { KeyListTable } from '@/components/keys/KeyListTable';
 import { KeyDetailPanel } from '@/components/keys/KeyDetailPanel';
 
 export default function Keys() {
   const { keys, loading, createKey, deleteKey, suspendKey, activateKey, revokeKey, updateKey } = useLicenseKeys();
   const { products } = useProducts();
   const [searchQuery, setSearchQuery] = useState('');
   const [statusFilter, setStatusFilter] = useState('all');
   const [deleteId, setDeleteId] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [selectedKey, setSelectedKey] = useState<LicenseKey | null>(null);
   const [showGenerator, setShowGenerator] = useState(false);
 
   // Filter keys based on search and status
   const filteredKeys = useMemo(() => {
     return keys.filter((key) => {
       const matchesSearch =
         key.license_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
         key.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         key.owner_email?.toLowerCase().includes(searchQuery.toLowerCase());
 
       const matchesStatus = statusFilter === 'all' || key.status === statusFilter;
 
       return matchesSearch && matchesStatus;
     });
   }, [keys, searchQuery, statusFilter]);
 
   // Calculate stats
   const stats = useMemo(() => ({
     active: keys.filter(k => k.status === 'active').length,
     suspended: keys.filter(k => k.status === 'suspended').length,
     expired: keys.filter(k => k.status === 'expired').length,
     total: keys.length,
   }), [keys]);
 
   const handleGenerate = async (data: {
     product_id: string;
     key_type: 'lifetime' | 'yearly' | 'monthly' | 'trial';
     license_key: string;
     owner_name: string;
     owner_email: string;
     max_devices: number;
     expires_at: string;
     notes: string;
   }) => {
     setSubmitting(true);
     try {
       await createKey({
         product_id: data.product_id,
         key_type: data.key_type,
         license_key: data.license_key,
         owner_name: data.owner_name || null,
         owner_email: data.owner_email || null,
         max_devices: data.max_devices,
         expires_at: data.expires_at || null,
         notes: data.notes || null,
       });
       setShowGenerator(false);
     } finally {
       setSubmitting(false);
     }
   };
 
   const handleDelete = async () => {
     if (!deleteId) return;
     await deleteKey(deleteId);
     setDeleteId(null);
   };
 
   const handleStatusChange = async (id: string, status: 'active' | 'suspended') => {
     if (status === 'active') {
       await activateKey(id);
     } else {
       await suspendKey(id);
     }
     // Refresh selected key if it's the one being updated
     if (selectedKey?.id === id) {
       const updated = keys.find(k => k.id === id);
       if (updated) {
         setSelectedKey({ ...updated, status });
       }
     }
   };
 
   const getProductName = (productId: string) => {
     return products.find(p => p.id === productId)?.name || 'Unknown';
   };
 
   return (
     <DashboardLayout>
       <div className="space-y-6">
         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
               <Key className="h-6 w-6 text-primary" />
               Key Generator Panel
             </h2>
             <p className="text-muted-foreground">
               Generate and manage license, API, and feature keys
             </p>
           </div>
           <Button
             onClick={() => setShowGenerator(!showGenerator)}
             className="bg-orange-gradient hover:opacity-90 text-white gap-2 min-h-[44px]"
           >
             <Plus className="h-4 w-4" />
             Generate Key
           </Button>
         </div>
 
         {/* Filter Row */}
         <KeyFilterRow
           searchQuery={searchQuery}
           onSearchChange={setSearchQuery}
           statusFilter={statusFilter}
           onStatusChange={setStatusFilter}
         />
 
         {/* Status Cards */}
         <KeyStatsCards stats={stats} />
 
         {/* Key Generator Form (Collapsible) */}
         {showGenerator && (
           <KeyGeneratorForm
             products={products}
             onGenerate={handleGenerate}
             submitting={submitting}
           />
         )}
 
         {/* Key List Table */}
         <div className="glass-card rounded-xl overflow-hidden">
           <KeyListTable
             keys={filteredKeys}
             loading={loading}
             onRowClick={setSelectedKey}
             onSuspend={suspendKey}
             onActivate={activateKey}
             onRevoke={revokeKey}
             onDelete={setDeleteId}
             getProductName={getProductName}
           />
         </div>
       </div>
 
       {/* Key Detail Panel (Slide) */}
       <KeyDetailPanel
         keyData={selectedKey}
         open={!!selectedKey}
         onClose={() => setSelectedKey(null)}
         onStatusChange={handleStatusChange}
         getProductName={getProductName}
       />
 
       {/* Delete Confirmation */}
       <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete License Key?</AlertDialogTitle>
             <AlertDialogDescription>
               This action cannot be undone. The license key will be permanently deleted.
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
