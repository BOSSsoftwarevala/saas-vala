import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PaymentSettings {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  account_type: string;
  upi_id: string;
  wise_pay_link: string;
  binance_pay_id: string;
  remitly_note: string;
  upi_enabled: boolean;
  bank_enabled: boolean;
  wise_enabled: boolean;
  crypto_enabled: boolean;
  remitly_enabled: boolean;
  razorpay_enabled: boolean;
  razorpay_key_id: string;
  razorpay_key_secret: string;
  stripe_enabled: boolean;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  wallet_enabled: boolean;
  updated_at: string;
}

const DEFAULTS: PaymentSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  bank_name: '',
  account_name: '',
  account_number: '',
  ifsc_code: '',
  branch_name: '',
  account_type: '',
  upi_id: '',
  wise_pay_link: '',
  binance_pay_id: '',
  remitly_note: '',
  upi_enabled: true,
  bank_enabled: true,
  wise_enabled: true,
  crypto_enabled: true,
  remitly_enabled: true,
  razorpay_enabled: false,
  razorpay_key_id: '',
  razorpay_key_secret: '',
  stripe_enabled: false,
  stripe_publishable_key: '',
  stripe_secret_key: '',
  wallet_enabled: true,
  updated_at: new Date().toISOString(),
};

export function usePaymentSettings() {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('payment_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      if (!error && data) {
        setSettings({ ...DEFAULTS, ...data });
      }
    } catch {
      // fallback to defaults on any error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async (updates: Partial<PaymentSettings>): Promise<boolean> => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('payment_settings')
        .update({ ...updates, updated_at: new Date().toISOString(), updated_by: userData.user?.id ?? null })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...updates }));
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Mask helpers
  const maskAccountNumber = (num: string) =>
    num.length > 4 ? '••••••' + num.slice(-4) : num;

  const maskIfsc = (ifsc: string) =>
    ifsc.length > 6 ? ifsc.slice(0, 4) + '•••' + ifsc.slice(-3) : ifsc;

  const maskBinance = (id: string) =>
    id.length > 4 ? '•••••' + id.slice(-4) : id;

  return {
    settings,
    loading,
    saving,
    saveSettings,
    maskAccountNumber,
    maskIfsc,
    maskBinance,
    refresh: fetchSettings,
  };
}
