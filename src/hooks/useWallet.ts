import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allWallets, setAllWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchWallet = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
    } else {
      setWallet(data);
    }
    setLoading(false);
  };

  const fetchAllWallets = async () => {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .order('balance', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setAllWallets(data || []);
    }
  };

  const fetchTransactions = async (page = 1, limit = 25) => {
    if (!wallet) return;
    
    const { data, error, count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error(error);
    } else {
      setTransactions((data || []) as Transaction[]);
      setTotal(count || 0);
    }
  };

  const addCredit = async (walletId: string, amount: number, description: string) => {
    const { data: userData } = await supabase.auth.getUser();
    
    // Get current balance
    const { data: walletData } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .single();

    const newBalance = (walletData?.balance || 0) + amount;

    // Create transaction
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        wallet_id: walletId,
        type: 'credit',
        amount,
        balance_after: newBalance,
        status: 'completed',
        description,
        created_by: userData.user?.id
      });

    if (txError) {
      toast.error('Failed to add credit');
      throw txError;
    }

    // Update wallet balance
    const { error: walletError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId);

    if (walletError) {
      toast.error('Failed to update wallet');
      throw walletError;
    }

    toast.success(`Added ₹${amount} credit`);
    await fetchWallet();
    await fetchAllWallets();
  };

  const deductBalance = async (walletId: string, amount: number, description: string) => {
    const { data: userData } = await supabase.auth.getUser();
    
    // Get current balance
    const { data: walletData } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .single();

    if ((walletData?.balance || 0) < amount) {
      toast.error('Insufficient balance');
      throw new Error('Insufficient balance');
    }

    const newBalance = (walletData?.balance || 0) - amount;

    // Create transaction
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        wallet_id: walletId,
        type: 'debit',
        amount,
        balance_after: newBalance,
        status: 'completed',
        description,
        created_by: userData.user?.id
      });

    if (txError) {
      toast.error('Failed to deduct balance');
      throw txError;
    }

    // Update wallet balance
    await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId);

    toast.success(`Deducted ₹${amount}`);
    await fetchWallet();
    await fetchAllWallets();
  };

  useEffect(() => {
    fetchWallet();
    fetchAllWallets();
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
    fetchWallet,
    fetchTransactions,
    fetchAllWallets,
    addCredit,
    deductBalance
  };
}
