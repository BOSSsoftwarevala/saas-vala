// Plan/Subscription Engine for Key Management
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended' | 'pending';
export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: BillingCycle;
  features: string[];
  max_keys: number;
  max_devices_per_key: number;
  max_api_calls_per_month: number;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string;
  auto_renew: boolean;
  payment_method_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class SubscriptionService {
  /**
   * Create plan
   */
  async createPlan(plan: Partial<Plan>): Promise<Plan | null> {
    try {
      const { data, error } = await supabase
        .from('plans')
        .insert({
          name: plan.name,
          description: plan.description,
          price: plan.price || 0,
          currency: plan.currency || 'USD',
          billing_cycle: plan.billing_cycle || 'monthly',
          features: plan.features || [],
          max_keys: plan.max_keys || 1,
          max_devices_per_key: plan.max_devices_per_key || 1,
          max_api_calls_per_month: plan.max_api_calls_per_month || 1000,
          is_active: plan.is_active !== undefined ? plan.is_active : true,
          is_public: plan.is_public !== undefined ? plan.is_public : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Plan;
    } catch (error) {
      console.error('Error creating plan:', error);
      return null;
    }
  }

  /**
   * Get all plans
   */
  async getPlans(includeInactive = false): Promise<Plan[]> {
    try {
      let query = supabase.from('plans').select('*');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('price', { ascending: true });

      if (error) throw error;
      return (data as Plan[]) || [];
    } catch (error) {
      console.error('Error getting plans:', error);
      return [];
    }
  }

  /**
   * Get public plans
   */
  async getPublicPlans(): Promise<Plan[]> {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return (data as Plan[]) || [];
    } catch (error) {
      console.error('Error getting public plans:', error);
      return [];
    }
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<Plan | null> {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      return data as Plan;
    } catch (error) {
      console.error('Error getting plan by ID:', error);
      return null;
    }
  }

  /**
   * Update plan
   */
  async updatePlan(planId: string, updates: Partial<Plan>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('plans')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating plan:', error);
      return false;
    }
  }

  /**
   * Delete plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting plan:', error);
      return false;
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(
    userId: string,
    planId: string,
    autoRenew = true
  ): Promise<Subscription | null> {
    try {
      const plan = await this.getPlanById(planId);

      if (!plan) {
        return null;
      }

      // Calculate end date based on billing cycle
      let endDate: Date | undefined;
      if (plan.billing_cycle === 'monthly') {
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else if (plan.billing_cycle === 'yearly') {
        endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }
      // Lifetime has no end date

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: endDate?.toISOString(),
          auto_renew: autoRenew,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      return null;
    }
  }

  /**
   * Get user subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as Subscription;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (error) throw error;
      return data as Subscription;
    } catch (error) {
      console.error('Error getting subscription by ID:', error);
      return null;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Subscription>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating subscription:', error);
      return false;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediate = false
  ): Promise<boolean> {
    try {
      if (immediate) {
        await this.updateSubscription(subscriptionId, {
          status: 'cancelled',
          end_date: new Date().toISOString(),
        });
      } else {
        await this.updateSubscription(subscriptionId, {
          status: 'cancelled',
          auto_renew: false,
        });
      }

      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }

  /**
   * Suspend subscription
   */
  async suspendSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.updateSubscription(subscriptionId, {
        status: 'suspended',
      });

      return true;
    } catch (error) {
      console.error('Error suspending subscription:', error);
      return false;
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.updateSubscription(subscriptionId, {
        status: 'active',
      });

      return true;
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      return false;
    }
  }

  /**
   * Renew subscription
   */
  async renewSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);

      if (!subscription) {
        return false;
      }

      const plan = await this.getPlanById(subscription.plan_id);

      if (!plan) {
        return false;
      }

      // Calculate new end date
      let endDate: Date | undefined;
      if (plan.billing_cycle === 'monthly') {
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else if (plan.billing_cycle === 'yearly') {
        endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }

      await this.updateSubscription(subscriptionId, {
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: endDate?.toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Error renewing subscription:', error);
      return false;
    }
  }

  /**
   * Change subscription plan
   */
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPlanId: string
  ): Promise<boolean> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);

      if (!subscription) {
        return false;
      }

      const newPlan = await this.getPlanById(newPlanId);

      if (!newPlan) {
        return false;
      }

      // Calculate new end date based on new plan's billing cycle
      let endDate: Date | undefined;
      if (newPlan.billing_cycle === 'monthly') {
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else if (newPlan.billing_cycle === 'yearly') {
        endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }

      await this.updateSubscription(subscriptionId, {
        plan_id: newPlanId,
        end_date: endDate?.toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Error changing subscription plan:', error);
      return false;
    }
  }

  /**
   * Check if user can create key based on subscription
   */
  async canUserCreateKey(userId: string): Promise<{
    can_create: boolean;
    reason?: string;
    current_keys: number;
    max_keys: number;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);

      if (!subscription) {
        return {
          can_create: false,
          reason: 'No active subscription',
          current_keys: 0,
          max_keys: 0,
        };
      }

      const plan = await this.getPlanById(subscription.plan_id);

      if (!plan) {
        return {
          can_create: false,
          reason: 'Plan not found',
          current_keys: 0,
          max_keys: 0,
        };
      }

      // Get current key count
      const { count } = await supabase
        .from('keys')
        .select('id', { count: 'exact' })
        .eq('assigned_user_id', userId)
        .is('deleted_at', null);

      const currentKeys = count || 0;

      if (currentKeys >= plan.max_keys) {
        return {
          can_create: false,
          reason: 'Maximum keys limit reached',
          current_keys,
          max_keys: plan.max_keys,
        };
      }

      return {
        can_create: true,
        current_keys,
        max_keys: plan.max_keys,
      };
    } catch (error) {
      console.error('Error checking if user can create key:', error);
      return {
        can_create: false,
        reason: 'Error checking subscription',
        current_keys: 0,
        max_keys: 0,
      };
    }
  }

  /**
   * Check if user can add device to key
   */
  async canUserAddDevice(userId: string, keyId: string): Promise<{
    can_add: boolean;
    reason?: string;
    current_devices: number;
    max_devices: number;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);

      if (!subscription) {
        return {
          can_add: false,
          reason: 'No active subscription',
          current_devices: 0,
          max_devices: 0,
        };
      }

      const plan = await this.getPlanById(subscription.plan_id);

      if (!plan) {
        return {
          can_add: false,
          reason: 'Plan not found',
          current_devices: 0,
          max_devices: 0,
        };
      }

      // Get current device count for key
      const { data: key } = await supabase
        .from('keys')
        .select('device_bindings')
        .eq('id', keyId)
        .single();

      const currentDevices = key?.device_bindings?.length || 0;

      if (currentDevices >= plan.max_devices_per_key) {
        return {
          can_add: false,
          reason: 'Maximum devices per key limit reached',
          current_devices,
          max_devices: plan.max_devices_per_key,
        };
      }

      return {
        can_add: true,
        current_devices,
        max_devices: plan.max_devices_per_key,
      };
    } catch (error) {
      console.error('Error checking if user can add device:', error);
      return {
        can_add: false,
        reason: 'Error checking subscription',
        current_devices: 0,
        max_devices: 0,
      };
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats(): Promise<{
    total_subscriptions: number;
    active_subscriptions: number;
    expired_subscriptions: number;
    cancelled_subscriptions: number;
    suspended_subscriptions: number;
    total_plans: number;
    active_plans: number;
    revenue_this_month: number;
  }> {
    try {
      const [
        totalSubsResult,
        activeSubsResult,
        expiredSubsResult,
        cancelledSubsResult,
        suspendedSubsResult,
        totalPlansResult,
        activePlansResult,
      ] = await Promise.all([
        supabase.from('subscriptions').select('id', { count: 'exact' }),
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact' })
          .eq('status', 'active'),
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact' })
          .eq('status', 'expired'),
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact' })
          .eq('status', 'cancelled'),
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact' })
          .eq('status', 'suspended'),
        supabase.from('plans').select('id', { count: 'exact' }),
        supabase
          .from('plans')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
      ]);

      // Calculate revenue this month (simplified)
      const revenueThisMonth = 0; // Would need to be calculated from payments

      return {
        total_subscriptions: totalSubsResult.count || 0,
        active_subscriptions: activeSubsResult.count || 0,
        expired_subscriptions: expiredSubsResult.count || 0,
        cancelled_subscriptions: cancelledSubsResult.count || 0,
        suspended_subscriptions: suspendedSubsResult.count || 0,
        total_plans: totalPlansResult.count || 0,
        active_plans: activePlansResult.count || 0,
        revenue_this_month: revenueThisMonth,
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      return {
        total_subscriptions: 0,
        active_subscriptions: 0,
        expired_subscriptions: 0,
        cancelled_subscriptions: 0,
        suspended_subscriptions: 0,
        total_plans: 0,
        active_plans: 0,
        revenue_this_month: 0,
      };
    }
  }

  /**
   * Check and expire subscriptions
   */
  async checkAndExpireSubscriptions(): Promise<number> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'expired',
        })
        .eq('status', 'active')
        .lt('end_date', new Date().toISOString());

      if (error) throw error;

      // Get count of expired subscriptions
      const { count } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact' })
        .eq('status', 'expired');

      return count || 0;
    } catch (error) {
      console.error('Error checking and expiring subscriptions:', error);
      return 0;
    }
  }
}

export const subscriptionService = new SubscriptionService();
