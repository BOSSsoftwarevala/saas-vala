import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Activity logging helper
export async function logProductActivity(
  action: string,
  productId: string,
  details?: Record<string, unknown>
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    
    await supabase.from('activity_logs').insert([{
      entity_type: 'product',
      entity_id: productId,
      action,
      performed_by: userData.user?.id,
      details: (details || {}) as Json,
      user_agent: navigator.userAgent,
    }]);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Health check trigger
export async function triggerHealthCheck(productId: string) {
  try {
    await supabase.rpc('update_product_health', { p_product_id: productId });
  } catch (error) {
    console.error('Failed to update health check:', error);
  }
}

// Bulk operations with logging
export async function bulkSuspendProducts(productIds: string[]) {
  const results = { success: 0, failed: 0 };
  
  for (const id of productIds) {
    const { error } = await supabase
      .from('products')
      .update({ status: 'suspended' })
      .eq('id', id);
    
    if (error) {
      results.failed++;
    } else {
      results.success++;
      await logProductActivity('suspend', id, { bulk: true });
    }
  }
  
  return results;
}

export async function bulkActivateProducts(productIds: string[]) {
  const results = { success: 0, failed: 0 };
  
  for (const id of productIds) {
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', id);
    
    if (error) {
      results.failed++;
    } else {
      results.success++;
      await logProductActivity('activate', id, { bulk: true });
    }
  }
  
  return results;
}

export async function bulkApproveDrafts(productIds: string[]) {
  const results = { success: 0, failed: 0 };
  
  for (const id of productIds) {
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', id);
    
    if (error) {
      results.failed++;
    } else {
      results.success++;
      await logProductActivity('approve', id, { from: 'draft', to: 'active' });
    }
  }
  
  return results;
}

// Validate role before action
export async function validateSuperAdminRole(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    toast.error('Authentication required');
    return false;
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .single();

  if (roleData?.role !== 'super_admin') {
    toast.error('Super Admin access required');
    return false;
  }

  return true;
}

// Brand metadata injector
export function getBrandMeta() {
  return {
    brand: 'SoftwareVala™',
    powered_by: 'SaaS VALA',
    copyright: `© ${new Date().getFullYear()} SaaS VALA`,
    version: '1.0.0',
  };
}
