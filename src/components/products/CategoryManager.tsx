import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Ban, Play, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type CategoryLevel = Database['public']['Enums']['category_level'];

interface Category {
  id: string;
  name: string;
  slug: string;
  level: CategoryLevel;
  parent_id: string | null;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number | null;
}

interface CategoryManagerProps {
  level: CategoryLevel;
  title: string;
}

const levelOrder: CategoryLevel[] = ['master', 'sub', 'micro', 'nano'];

export function CategoryManager({ level, title }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    parent_id: '',
    is_active: true,
  });

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('level', level)
      .order('sort_order');

    if (error) {
      toast.error('Failed to fetch categories');
      console.error(error);
    } else {
      setCategories((data || []) as Category[]);
    }
    setLoading(false);
  };

  const fetchParentCategories = async () => {
    const levelIndex = levelOrder.indexOf(level);
    if (levelIndex === 0) return; // Master has no parent

    const parentLevel = levelOrder[levelIndex - 1];
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('level', parentLevel)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error(error);
    } else {
      setParentCategories((data || []) as Category[]);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchParentCategories();
  }, [level]);

  const openCreateDialog = () => {
    setEditCategory(null);
    setFormData({
      name: '',
      icon: '',
      parent_id: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || '',
      parent_id: category.parent_id || '',
      is_active: category.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    const levelIndex = levelOrder.indexOf(level);
    if (levelIndex > 0 && !formData.parent_id) {
      toast.error('Parent category is required');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const slug = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      if (editCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name,
            slug,
            icon: formData.icon || null,
            parent_id: formData.parent_id || null,
            is_active: formData.is_active,
          })
          .eq('id', editCategory.id);

        if (error) throw error;
        toast.success('Category updated');
      } else {
        const { error } = await supabase.from('categories').insert({
          name: formData.name,
          slug,
          level,
          icon: formData.icon || null,
          parent_id: formData.parent_id || null,
          is_active: formData.is_active,
          created_by: userData.user?.id,
        });

        if (error) throw error;
        toast.success('Category created');
      }

      setDialogOpen(false);
      await fetchCategories();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from('categories').delete().eq('id', deleteId);

    if (error) {
      toast.error('Failed to delete category');
    } else {
      toast.success('Category deleted');
      await fetchCategories();
    }
    setDeleteId(null);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('categories')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(currentStatus ? 'Category disabled' : 'Category enabled');
      await fetchCategories();
    }
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = parentCategories.find((c) => c.id === parentId);
    return parent?.name || '-';
  };

  const levelIndex = levelOrder.indexOf(level);
  const showParentColumn = levelIndex > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Button onClick={openCreateDialog} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
          <Plus className="h-4 w-4" />
          Add {title.replace(' Categories', '')}
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-muted-foreground mb-4">No {title.toLowerCase()} found</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Category
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">ID</TableHead>
                <TableHead className="text-muted-foreground">Name</TableHead>
                {showParentColumn && (
                  <TableHead className="text-muted-foreground">Parent</TableHead>
                )}
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {category.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {category.icon && <span className="mr-2">{category.icon}</span>}
                    {category.name}
                  </TableCell>
                  {showParentColumn && (
                    <TableCell className="text-muted-foreground">
                      {getParentName(category.parent_id)}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        category.is_active
                          ? 'bg-success/20 text-success border-success/30'
                          : 'bg-destructive/20 text-destructive border-destructive/30'
                      }
                    >
                      {category.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(category)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus(category.id, category.is_active)}
                        className="h-8 w-8"
                      >
                        {category.is_active ? (
                          <Ban className="h-4 w-4 text-warning" />
                        ) : (
                          <Play className="h-4 w-4 text-success" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(category.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editCategory ? 'Edit' : 'Add'} {title.replace(' Categories', '')} Category
            </DialogTitle>
            <DialogDescription>
              {editCategory
                ? 'Update category details'
                : `Create a new ${level} category`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                placeholder="Enter category name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (Emoji)</Label>
              <Input
                placeholder="📦"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              />
            </div>
            {showParentColumn && (
              <div className="space-y-2">
                <Label>Parent Category *</Label>
                <Select
                  value={formData.parent_id}
                  onValueChange={(v) => setFormData({ ...formData, parent_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon && <span className="mr-2">{cat.icon}</span>}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Active Status</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !formData.name.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Products using this category will need to
              be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
