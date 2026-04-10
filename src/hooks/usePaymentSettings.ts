import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  updated_at: string;
}

const DEFAULTS: PaymentSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  bank_name: 'INDIAN BANK',
  account_name: 'SOFTWARE VALA',
  account_number: '8045924772',
  ifsc_code: 'IDIB000K196',
  branch_name: 'KANKAR BAGH',
  account_type: 'Current',
  upi_id: 'softwarevala@indianbank',
  wise_pay_link: 'https://wise.com/pay/business/manojkumar21?utm_source=quick_pay',
  binance_pay_id: '1078928519',
  remitly_note: 'Send to Indian Bank Account (same as Bank Transfer)',
  upi_enabled: true,
  bank_enabled: true,
  wise_enabled: true,
  crypto_enabled: true,
  remitly_enabled: true,
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
