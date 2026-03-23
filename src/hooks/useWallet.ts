import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { walletApi } from '@/lib/api';

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  is_locked: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'credit' | 'debit' | 'refund' | 'adjustment' | 'purchase';
  amount: number;
  balance_after: number | null;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allWallets, setAllWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [activeLicenses, setActiveLicenses] = useState(0);
  const [expiringLicenses, setExpiringLicenses] = useState(0);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const res = await walletApi.get();
      setWallet(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchAllWallets = async () => {
    try {
      const res = await walletApi.all();
      setAllWallets(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTransactions = async (page = 1, limit = 25) => {
    if (!wallet) return;
    try {
      const res = await walletApi.transactions({ page, limit });
      setTransactions((res.data || []) as Transaction[]);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLicenseStats = async () => {
    // License stats still fetched via keys API
    try {
      const { keysApi } = await import('@/lib/api');
      const res = await keysApi.list();
      const keys = res.data || [];
      const active = keys.filter((k: any) => k.status === 'active');
      setActiveLicenses(active.length);

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const expiring = active.filter((k: any) => k.expires_at && new Date(k.expires_at) < sevenDaysFromNow);
      setExpiringLicenses(expiring.length);
    } catch (e) {
      console.error(e);
    }
  };

  const addCredit = async (walletId: string, amount: number, description: string, paymentMethod?: string) => {
    try {
      const res = await walletApi.add(amount, description, paymentMethod);
      toast.success(`Added ₹${amount} credit`);
      await fetchWallet();
      await fetchAllWallets();
      return res;
    } catch (e: any) {
      toast.error('Failed to add credit');
      throw e;
    }
  };

  const deductBalance = async (walletId: string, amount: number, description: string, referenceId?: string, referenceType?: string) => {
    try {
      const res = await walletApi.withdraw(amount, description, referenceId, referenceType);
      toast.success(`Deducted ₹${amount}`);
      await fetchWallet();
      await fetchAllWallets();
      return res;
    } catch (e: any) {
      toast.error(e.message || 'Failed to deduct balance');
      throw e;
    }
  };

  const getLastPaymentStatus = (): { status: 'success' | 'failed' | 'pending' | null; amount: number } => {
    const lastTx = transactions.find(t => t.type === 'credit' || t.type === 'purchase');
    if (!lastTx) return { status: null, amount: 0 };
    return {
      status: lastTx.status === 'completed' ? 'success' :
              lastTx.status === 'failed' ? 'failed' : 'pending',
      amount: lastTx.amount
    };
  };

  useEffect(() => {
    fetchWallet();
    fetchAllWallets();
    fetchLicenseStats();
  }, []);

  useEffect(() => {
    if (wallet) {
      fetchTransactions();
    }
  }, [wallet]);

  return {
    wallet,
    transactions,
    allWallets,
    loading,
    total,
    activeLicenses,
    expiringLicenses,
    fetchWallet,
    fetchTransactions,
    fetchAllWallets,
    addCredit,
    deductBalance,
    getLastPaymentStatus
  };
}
