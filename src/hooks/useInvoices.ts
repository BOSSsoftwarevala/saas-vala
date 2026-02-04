import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax_percent: number | null;
  tax_amount: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  total_amount: number;
  status: string;
  notes: string | null;
  terms: string | null;
  due_date: string | null;
  currency: string;
  signature_data: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  otp_verified: boolean;
  otp_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFormData {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  items: InvoiceItem[];
  tax_percent?: number;
  discount_percent?: number;
  notes?: string;
  terms?: string;
  due_date?: string;
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchInvoices = async (page = 1, limit = 25) => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data, error, count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } else {
      // Transform the items from Json to InvoiceItem[]
      const transformedData = (data || []).map(inv => ({
        ...inv,
        items: Array.isArray(inv.items) ? (inv.items as unknown as InvoiceItem[]) : []
      }));
      setInvoices(transformedData);
      setTotal(count || 0);
    }
    setLoading(false);
  };

  const createInvoice = async (formData: InvoiceFormData): Promise<Invoice | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error('Not authenticated');
      return null;
    }

    // Calculate amounts
    const subtotal = formData.items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = formData.tax_percent ? (subtotal * formData.tax_percent) / 100 : 0;
    const discountAmount = formData.discount_percent ? (subtotal * formData.discount_percent) / 100 : 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Generate invoice number
    const { data: invoiceNumData } = await supabase.rpc('generate_invoice_number');
    const invoiceNumber = invoiceNumData || `SV-${new Date().getFullYear()}-${Date.now()}`;

    const { data, error } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        user_id: userData.user.id,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || null,
        customer_address: formData.customer_address || null,
        items: JSON.parse(JSON.stringify(formData.items)),
        subtotal,
        tax_percent: formData.tax_percent || 0,
        tax_amount: taxAmount,
        discount_percent: formData.discount_percent || 0,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        notes: formData.notes || null,
        terms: formData.terms || 'Payment due within 30 days.',
        due_date: formData.due_date || null,
        status: 'draft'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
      return null;
    }

    toast.success(`Invoice ${data.invoice_number} created`);
    await fetchInvoices();
    return {
      ...data,
      items: Array.isArray(data.items) ? (data.items as unknown as InvoiceItem[]) : []
    };
  };

  const updateInvoice = async (id: string, updates: Partial<InvoiceFormData>): Promise<boolean> => {
    // Recalculate amounts if items changed
    let calculatedUpdates: Record<string, unknown> = { ...updates };
    
    if (updates.items) {
      const subtotal = updates.items.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = updates.tax_percent ? (subtotal * updates.tax_percent) / 100 : 0;
      const discountAmount = updates.discount_percent ? (subtotal * updates.discount_percent) / 100 : 0;
      
      calculatedUpdates = {
        ...updates,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: subtotal + taxAmount - discountAmount
      };
    }

    const { error } = await supabase
      .from('invoices')
      .update(calculatedUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice');
      return false;
    }

    toast.success('Invoice updated');
    await fetchInvoices();
    return true;
  };

  const deleteInvoice = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice');
      return false;
    }

    toast.success('Invoice deleted');
    await fetchInvoices();
    return true;
  };

  const sendInvoice = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'pending' })
      .eq('id', id);

    if (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice');
      return false;
    }

    toast.success('Invoice sent to customer');
    await fetchInvoices();
    return true;
  };

  const markAsPaid = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'paid' })
      .eq('id', id);

    if (error) {
      console.error('Error marking invoice as paid:', error);
      toast.error('Failed to update invoice');
      return false;
    }

    toast.success('Invoice marked as paid');
    await fetchInvoices();
    return true;
  };

  const saveSignature = async (id: string, signatureData: string, signerIp: string): Promise<boolean> => {
    const { error } = await supabase
      .from('invoices')
      .update({
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        signer_ip: signerIp,
        status: 'signed'
      })
      .eq('id', id);

    if (error) {
      console.error('Error saving signature:', error);
      toast.error('Failed to save signature');
      return false;
    }

    toast.success('Signature saved');
    await fetchInvoices();
    return true;
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return {
    invoices,
    loading,
    total,
    fetchInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    sendInvoice,
    markAsPaid,
    saveSignature
  };
}
