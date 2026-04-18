import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { leadsApi, seoApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: 'website' | 'referral' | 'social' | 'ads' | 'organic' | 'other';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  product_id: string | null;
  notes: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  converted_at: string | null;
  created_at: string;
}

export interface SeoData {
  id: string;
  product_id: string | null;
  url: string;
  title: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  og_image: string | null;
  robots: string;
  created_at: string;
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [seoData, setSeoData] = useState<SeoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchLeads = async (page = 1, limit = 25, search = '') => {
    setLoading(true);
    try {
      const res = await leadsApi.list({ page, limit, search });
      setLeads((res.data || []) as Lead[]);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast.error('Failed to fetch leads');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeoData = async () => {
    try {
      const res = await seoApi.analytics();
      setSeoData((res.data || []) as SeoData[]);
    } catch (e) {
      console.error(e);
    }
  };

  const createLead = async (lead: Partial<Lead>) => {
    try {
      const res = await leadsApi.create(lead);
      toast.success('Lead created');
      await fetchLeads();
      return res.data;
    } catch (e: any) {
      toast.error('Failed to create lead');
      throw e;
    }
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    // Lead updates still use Supabase SDK (no dedicated API endpoint yet)
    const { error } = await supabase.from('leads').update(updates).eq('id', id);
    if (error) {
      toast.error('Failed to update lead');
      throw error;
    }
    toast.success('Lead updated');
    await fetchLeads();
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete lead');
      throw error;
    }
    toast.success('Lead deleted');
    await fetchLeads();
  };

  const convertLead = async (id: string) => {
    await updateLead(id, { status: 'converted', converted_at: new Date().toISOString() });
  };

  const markContacted = async (id: string) => {
    await updateLead(id, { status: 'contacted' });
  };

  const markConverted = async (id: string) => {
    await updateLead(id, { status: 'converted', converted_at: new Date().toISOString() });
  };

  const createSeoEntry = async (seo: Partial<SeoData>) => {
    const { data, error } = await supabase.from('seo_data').insert({
      url: seo.url || '', product_id: seo.product_id,
      title: seo.title, meta_description: seo.meta_description,
      keywords: seo.keywords, og_image: seo.og_image,
      robots: seo.robots || 'index, follow',
    }).select().single();
    if (error) { toast.error('Failed to create SEO entry'); throw error; }
    toast.success('SEO data saved');
    await fetchSeoData();
    return data;
  };

  const updateSeoEntry = async (id: string, updates: Partial<SeoData>) => {
    const { error } = await supabase.from('seo_data').update(updates).eq('id', id);
    if (error) { toast.error('Failed to update SEO data'); throw error; }
    toast.success('SEO data updated');
    await fetchSeoData();
  };

  const deleteSeoEntry = async (id: string) => {
    const { error } = await supabase.from('seo_data').delete().eq('id', id);
    if (error) { toast.error('Failed to delete SEO entry'); throw error; }
    toast.success('SEO entry deleted');
    await fetchSeoData();
  };

  useEffect(() => {
    fetchLeads();
    fetchSeoData();
  }, []);

  return {
    leads, seoData, loading, total,
    fetchLeads, fetchSeoData,
    createLead, updateLead, deleteLead,
    convertLead, markContacted, markConverted,
    createSeoEntry, updateSeoEntry, deleteSeoEntry,
  };
}
