// Reseller Plan Badge + Activation Logic System

export interface ResellerPlan {
  id: string;
  name: string;
  price: number; // in INR
  badge: {
    emoji: string;
    color: string;
    label: string;
  };
  benefits: {
    freeKeys: number;
    marginPercentage: number;
    maxKeysPerMonth: number;
    supportLevel: 'basic' | 'priority' | 'premium' | 'vip';
    features: string[];
  };
  duration: number; // days
  active: boolean;
}

export interface ResellerAccount {
  id: string;
  userId: string;
  email: string;
  currentPlan?: ResellerPlan;
  planActivatedAt?: Date;
  planExpiresAt?: Date;
  usedKeys: number;
  totalKeys: number;
  totalEarnings: number;
  paymentHistory: PaymentRecord[];
  generatedKeys: GeneratedKey[];
}

export interface PaymentRecord {
  id: string;
  resellerId: string;
  planId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionId: string;
  createdAt: Date;
  completedAt?: Date;
  validated: boolean;
}

export interface GeneratedKey {
  id: string;
  resellerId: string;
  key: string;
  type: 'free' | 'paid';
  planId: string;
  generatedAt: Date;
  used: boolean;
  usedAt?: Date;
  usedBy?: string;
}

// Predefined reseller plans
export const RESELLER_PLANS: Record<string, ResellerPlan> = {
  bronze: {
    id: 'bronze',
    name: 'Bronze Reseller',
    price: 99,
    badge: {
      emoji: '🥉',
      color: 'text-orange-500',
      label: 'Bronze'
    },
    benefits: {
      freeKeys: 10,
      marginPercentage: 20,
      maxKeysPerMonth: 50,
      supportLevel: 'basic',
      features: ['basic_dashboard', 'key_generation', 'earnings_report']
    },
    duration: 30,
    active: true
  },
  silver: {
    id: 'silver',
    name: 'Silver Reseller',
    price: 299,
    badge: {
      emoji: '🥈',
      color: 'text-gray-400',
      label: 'Silver'
    },
    benefits: {
      freeKeys: 50,
      marginPercentage: 30,
      maxKeysPerMonth: 200,
      supportLevel: 'priority',
      features: ['basic_dashboard', 'key_generation', 'earnings_report', 'analytics', 'bulk_operations']
    },
    duration: 30,
    active: true
  },
  gold: {
    id: 'gold',
    name: 'Gold Reseller',
    price: 499,
    badge: {
      emoji: '🥇',
      color: 'text-yellow-500',
      label: 'Gold'
    },
    benefits: {
      freeKeys: 150,
      marginPercentage: 40,
      maxKeysPerMonth: 500,
      supportLevel: 'premium',
      features: ['basic_dashboard', 'key_generation', 'earnings_report', 'analytics', 'bulk_operations', 'white_label', 'api_access']
    },
    duration: 30,
    active: true
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond Reseller',
    price: 999,
    badge: {
      emoji: '💎',
      color: 'text-blue-500',
      label: 'Diamond'
    },
    benefits: {
      freeKeys: 500,
      marginPercentage: 50,
      maxKeysPerMonth: 2000,
      supportLevel: 'vip',
      features: ['basic_dashboard', 'key_generation', 'earnings_report', 'analytics', 'bulk_operations', 'white_label', 'api_access', 'dedicated_support', 'custom_branding']
    },
    duration: 30,
    active: true
  }
};

class ResellerPlanSystem {
  private static instance: ResellerPlanSystem;
  private resellerAccounts: Map<string, ResellerAccount> = new Map();
  private paymentRecords: Map<string, PaymentRecord> = new Map();
  private generatedKeys: Map<string, GeneratedKey> = new Map();

  static getInstance(): ResellerPlanSystem {
    if (!ResellerPlanSystem.instance) {
      ResellerPlanSystem.instance = new ResellerPlanSystem();
    }
    return ResellerPlanSystem.instance;
  }

  // Initialize reseller account
  async initializeResellerAccount(userId: string, email: string): Promise<ResellerAccount> {
    const account: ResellerAccount = {
      id: `reseller-${userId}`,
      userId,
      email,
      usedKeys: 0,
      totalKeys: 0,
      totalEarnings: 0,
      paymentHistory: [],
      generatedKeys: []
    };

    this.resellerAccounts.set(userId, account);
    return account;
  }

  // Process payment and activate plan
  async processPaymentAndActivatePlan(
    userId: string,
    planId: string,
    paymentData: {
      amount: number;
      currency: string;
      paymentMethod: string;
      transactionId: string;
    }
  ): Promise<{ success: boolean; account?: ResellerAccount; error?: string }> {
    try {
      // Validate payment data
      const plan = RESELLER_PLANS[planId];
      if (!plan) {
        return { success: false, error: 'Invalid plan selected' };
      }

      if (paymentData.amount !== plan.price) {
        return { success: false, error: 'Payment amount mismatch' };
      }

      // Get or create reseller account
      let account = this.resellerAccounts.get(userId);
      if (!account) {
        // This would typically get user info from a user service
        account = await this.initializeResellerAccount(userId, 'user@example.com');
      }

      // Check for existing active plan
      if (account.currentPlan && account.planExpiresAt && account.planExpiresAt > new Date()) {
        return { success: false, error: 'Active plan already exists' };
      }

      // Create payment record
      const paymentRecord: PaymentRecord = {
        id: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        resellerId: account.id,
        planId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: 'pending',
        paymentMethod: paymentData.paymentMethod,
        transactionId: paymentData.transactionId,
        createdAt: new Date(),
        validated: false
      };

      this.paymentRecords.set(paymentRecord.id, paymentRecord);

      // Validate payment (in real implementation, this would verify with payment gateway)
      const paymentValidated = await this.validatePayment(paymentRecord);
      
      if (!paymentValidated) {
        paymentRecord.status = 'failed';
        return { success: false, error: 'Payment validation failed' };
      }

      // Activate plan
      const activationResult = await this.activatePlan(account, plan, paymentRecord);
      
      if (activationResult.success) {
        paymentRecord.status = 'completed';
        paymentRecord.completedAt = new Date();
        paymentRecord.validated = true;
        
        return { success: true, account: activationResult.account! };
      } else {
        paymentRecord.status = 'failed';
        return { success: false, error: activationResult.error };
      }

    } catch (error) {
      console.error('Payment processing error:', error);
      return { success: false, error: 'Payment processing failed' };
    }
  }

  // Validate payment with payment gateway
  private async validatePayment(paymentRecord: PaymentRecord): Promise<boolean> {
    // In real implementation, this would verify with payment gateway
    // For now, we'll simulate validation
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    
    // Simulate payment validation (95% success rate)
    return Math.random() > 0.05;
  }

  // Activate plan for reseller
  private async activatePlan(
    account: ResellerAccount,
    plan: ResellerPlan,
    paymentRecord: PaymentRecord
  ): Promise<{ success: boolean; account?: ResellerAccount; error?: string }> {
    try {
      // Update account with new plan
      account.currentPlan = plan;
      account.planActivatedAt = new Date();
      account.planExpiresAt = new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000);
      
      // Add free keys to account
      const freeKeys = await this.generateFreeKeys(account.id, plan.benefits.freeKeys, plan.id);
      account.generatedKeys.push(...freeKeys);
      account.totalKeys += freeKeys.length;

      // Add payment to history
      account.paymentHistory.push(paymentRecord);

      // Update account in storage
      this.resellerAccounts.set(account.userId, account);

      return { success: true, account };
    } catch (error) {
      console.error('Plan activation error:', error);
      return { success: false, error: 'Plan activation failed' };
    }
  }

  // Generate free keys for reseller
  private async generateFreeKeys(resellerId: string, count: number, planId: string): Promise<GeneratedKey[]> {
    const keys: GeneratedKey[] = [];
    
    for (let i = 0; i < count; i++) {
      const key: GeneratedKey = {
        id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        resellerId,
        key: this.generateLicenseKey(),
        type: 'free',
        planId,
        generatedAt: new Date(),
        used: false
      };
      
      keys.push(key);
      this.generatedKeys.set(key.id, key);
    }
    
    return keys;
  }

  // Generate license key
  private generateLicenseKey(): string {
    const prefix = 'VALA';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }

  // Get reseller account
  getResellerAccount(userId: string): ResellerAccount | undefined {
    return this.resellerAccounts.get(userId);
  }

  // Get available plans
  getAvailablePlans(): ResellerPlan[] {
    return Object.values(RESELLER_PLANS).filter(plan => plan.active);
  }

  // Check if user can generate key
  async canGenerateKey(userId: string): Promise<{ canGenerate: boolean; reason?: string }> {
    const account = this.resellerAccounts.get(userId);
    
    if (!account) {
      return { canGenerate: false, reason: 'No reseller account found' };
    }

    if (!account.currentPlan) {
      return { canGenerate: false, reason: 'No active plan' };
    }

    if (account.planExpiresAt && account.planExpiresAt < new Date()) {
      return { canGenerate: false, reason: 'Plan expired' };
    }

    const availableKeys = account.generatedKeys.filter(key => !key.used).length;
    if (availableKeys === 0) {
      return { canGenerate: false, reason: 'No available keys' };
    }

    return { canGenerate: true };
  }

  // Generate key for reseller
  async generateKeyForReseller(userId: string): Promise<{ success: boolean; key?: string; error?: string }> {
    const canGenerate = await this.canGenerateKey(userId);
    
    if (!canGenerate.canGenerate) {
      return { success: false, error: canGenerate.reason };
    }

    const account = this.resellerAccounts.get(userId)!;
    const availableKey = account.generatedKeys.find(key => !key.used);
    
    if (!availableKey) {
      return { success: false, error: 'No available keys' };
    }

    // Mark key as used
    availableKey.used = true;
    availableKey.usedAt = new Date();
    account.usedKeys++;

    // Update in storage
    this.generatedKeys.set(availableKey.id, availableKey);
    this.resellerAccounts.set(userId, account);

    return { success: true, key: availableKey.key };
  }

  // Get plan by price
  getPlanByPrice(price: number): ResellerPlan | undefined {
    return Object.values(RESELLER_PLANS).find(plan => plan.price === price);
  }

  // Check payment security (prevent duplicate abuse)
  async checkPaymentSecurity(transactionId: string, userId: string): Promise<{ secure: boolean; reason?: string }> {
    // Check if transaction ID already exists
    const existingPayment = Array.from(this.paymentRecords.values())
      .find(payment => payment.transactionId === transactionId);
    
    if (existingPayment) {
      return { secure: false, reason: 'Duplicate transaction ID' };
    }

    // Check user's recent payments (prevent rapid abuse)
    const recentPayments = Array.from(this.paymentRecords.values())
      .filter(payment => payment.resellerId === userId && 
        payment.createdAt > new Date(Date.now() - 5 * 60 * 1000)); // Last 5 minutes
    
    if (recentPayments.length >= 3) {
      return { secure: false, reason: 'Too many recent payments' };
    }

    return { secure: true };
  }

  // Get reseller statistics
  getResellerStats(userId: string): {
    totalKeys: number;
    usedKeys: number;
    availableKeys: number;
    totalEarnings: number;
    planStatus: string;
  } | undefined {
    const account = this.resellerAccounts.get(userId);
    if (!account) return undefined;

    const availableKeys = account.generatedKeys.filter(key => !key.used).length;
    let planStatus = 'No Plan';
    
    if (account.currentPlan) {
      if (account.planExpiresAt && account.planExpiresAt < new Date()) {
        planStatus = 'Expired';
      } else {
        planStatus = account.currentPlan.badge.label;
      }
    }

    return {
      totalKeys: account.totalKeys,
      usedKeys: account.usedKeys,
      availableKeys,
      totalEarnings: account.totalEarnings,
      planStatus
    };
  }

  // Update plan expiration check
  async updatePlanExpirationCheck(): Promise<void> {
    const now = new Date();
    
    for (const [userId, account] of this.resellerAccounts.entries()) {
      if (account.planExpiresAt && account.planExpiresAt < now && account.currentPlan) {
        // Plan expired, deactivate
        account.currentPlan = undefined;
        account.planExpiresAt = undefined;
        this.resellerAccounts.set(userId, account);
      }
    }
  }
}

export const resellerPlanSystem = ResellerPlanSystem.getInstance();
