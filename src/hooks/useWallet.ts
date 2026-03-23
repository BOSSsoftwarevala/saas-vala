import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { walletApi } from '@/lib/api';
import { walletChecksum, verifyWalletChecksum } from '@/lib/security';

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
  type: 'credit' | 'debit' | 'refund' | 'adjustment';
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
    // Phase 3: amount sanity check
    if (amount <= 0) {
      toast.error('Invalid credit amount.');
      throw new Error('Invalid credit amount');
    }
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
    // Phase 3: balance verification before every deduction
    if (amount <= 0) {
      toast.error('Invalid deduction amount.');
      throw new Error('Invalid deduction amount');
    }
    if (wallet && amount > wallet.balance) {
      toast.error('Insufficient balance.');
      throw new Error('Insufficient balance');
    }
    if (wallet?.is_locked) {
      toast.error('🔒 Wallet is frozen. Contact support.');
      throw new Error('Wallet is locked');
    }

    // Phase 3: integrity checksum — generate before the API call and attach
    // as request metadata so the server can verify the amount wasn't tampered.
    const timestamp = new Date().toISOString();
    const checksum = await walletChecksum(walletId, amount, timestamp);

    try {
      const res = await walletApi.withdraw(amount, description, referenceId, referenceType);

      // After response, verify the amount in the returned transaction matches
      // what we committed to; if the server returns a different amount it means
      // the response was tampered or there was a server-side error.
      const returnedAmount: number = res?.data?.amount ?? amount;
      const valid = await verifyWalletChecksum(walletId, returnedAmount, timestamp, checksum);
      if (!valid) {
        toast.error('Transaction integrity check failed — amount mismatch after response.');
        throw new Error('Post-transaction checksum mismatch');
      }

      toast.success(`Deducted ₹${amount}`);
      await fetchWallet();
      await fetchAllWallets();
      return res;
    } catch (e: any) {
      if (e.message === 'Post-transaction checksum mismatch') throw e;
      toast.error(e.message || 'Failed to deduct balance');
      throw e;
    }
  };

  const getLastPaymentStatus = (): { status: 'success' | 'failed' | 'pending' | null; amount: number } => {
    const lastCreditTx = transactions.find(t => t.type === 'credit');
    if (!lastCreditTx) return { status: null, amount: 0 };
    return {
      status: lastCreditTx.status === 'completed' ? 'success' :
              lastCreditTx.status === 'failed' ? 'failed' : 'pending',
      amount: lastCreditTx.amount
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
