import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ClientRequest {
  id: string;
  client_name: string;
  client_email: string | null;
  request_type: string;
  request_details: string;
  priority: string;
  status: string;
  ai_response: string | null;
  ai_action_taken: string | null;
  estimated_cost: number | null;
  created_at: string;
}

interface SoftwareQueue {
  id: string;
  software_name: string;
  software_type: string;
  target_industry: string;
  features: unknown;
  status: string;
  scheduled_date: string;
  ai_generated_description: string | null;
}

interface BillingTracker {
  id: string;
  service_type: string;
  service_name: string;
  provider: string | null;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_due_date: string;
  auto_pay: boolean;
  status: string;
}

interface SeoBacklink {
  id: string;
  product_id: string | null;
  target_url: string;
  backlink_url: string;
  anchor_text: string | null;
  domain_authority: number | null;
  status: string;
  backlink_type: string;
  source_type: string | null;
}

export function useAutomation() {
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>([]);
  const [softwareQueue, setSoftwareQueue] = useState<SoftwareQueue[]>([]);
  const [billingItems, setBillingItems] = useState<BillingTracker[]>([]);
  const [backlinks, setBacklinks] = useState<SeoBacklink[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    
    const [requestsRes, queueRes, billingRes, backlinksRes] = await Promise.all([
      supabase.from('client_requests').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('auto_software_queue').select('*').order('scheduled_date', { ascending: false }).limit(50),
      supabase.from('billing_tracker').select('*').order('next_due_date', { ascending: true }),
      supabase.from('seo_backlinks').select('*').order('created_at', { ascending: false }).limit(100)
    ]);

    if (requestsRes.data) setClientRequests(requestsRes.data as ClientRequest[]);
    if (queueRes.data) setSoftwareQueue(queueRes.data as SoftwareQueue[]);
    if (billingRes.data) setBillingItems(billingRes.data as BillingTracker[]);
    if (backlinksRes.data) setBacklinks(backlinksRes.data as SeoBacklink[]);
    
    setLoading(false);
  };

  // Submit new client request
  const submitClientRequest = async (request: {
    client_name: string;
    client_email?: string;
    request_type: string;
    request_details: string;
    priority?: string;
  }) => {
    setProcessing(true);
    
    try {
      // Insert request
      const { data: newRequest, error } = await supabase
        .from('client_requests')
        .insert({
          client_name: request.client_name,
          client_email: request.client_email,
          request_type: request.request_type,
          request_details: request.request_details,
          priority: request.priority || 'medium',
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Process with AI
      const { error: fnError } = await supabase.functions.invoke('ai-auto-pilot', {
        body: {
          action: 'handle_client_request',
          data: {
            requestId: newRequest.id,
            requestType: request.request_type,
            requestDetails: request.request_details,
            clientName: request.client_name
          }
        }
      });

      if (fnError) {
        console.error('AI processing error:', fnError);
      }

      toast.success('✅ Request submitted - AI is processing');
      await fetchData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit request');
    }
    
    setProcessing(false);
  };

  // Generate daily software (2 per day)
  const generateDailySoftware = async () => {
    setProcessing(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase.functions.invoke('ai-auto-pilot', {
        body: {
          action: 'generate_daily_software',
          data: { date: today }
        }
      });

      if (error) throw error;

      toast.success(`🚀 Generated ${data.products?.length || 0} new software products`);
      await fetchData();
    } catch (error) {
      console.error('Generate error:', error);
      toast.error('Failed to generate software');
    }
    
    setProcessing(false);
  };

  // Generate SEO for a product
  const generateSeo = async (productId: string, productName: string, productDescription: string) => {
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-auto-pilot', {
        body: {
          action: 'generate_seo_backlinks',
          data: { productId, productName, productDescription }
        }
      });

      if (error) throw error;

      toast.success('✅ SEO strategy generated');
      return data.seoData;
    } catch (error) {
      console.error('SEO error:', error);
      toast.error('Failed to generate SEO');
      return null;
    } finally {
      setProcessing(false);
    }
  };

  // Check billing alerts
  const checkBillingAlerts = async (userId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-auto-pilot', {
        body: {
          action: 'check_billing_alerts',
          data: { userId }
        }
      });

      if (error) throw error;

      if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach((alert: { type: string; message: string }) => {
          if (alert.type === '1_day_urgent') {
            toast.error(alert.message);
          } else {
            toast.warning(alert.message);
          }
        });
      }

      return data.alerts;
    } catch (error) {
      console.error('Billing check error:', error);
      return [];
    }
  };

  // Add billing item
  const addBillingItem = async (item: {
    service_type: string;
    service_name: string;
    provider?: string;
    amount: number;
    billing_cycle?: string;
    next_due_date: string;
    auto_pay?: boolean;
    notes?: string;
  }) => {
    try {
      const { error } = await supabase.from('billing_tracker').insert({
        service_type: item.service_type,
        service_name: item.service_name,
        provider: item.provider,
        amount: item.amount,
        billing_cycle: item.billing_cycle || 'monthly',
        next_due_date: item.next_due_date,
        auto_pay: item.auto_pay || false,
        notes: item.notes
      });

      if (error) throw error;

      toast.success('📅 Billing item added');
      await fetchData();
    } catch (error) {
      console.error('Add billing error:', error);
      toast.error('Failed to add billing item');
    }
  };

  // Get upcoming bills (next 7 days)
  const getUpcomingBills = () => {
    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    return billingItems.filter(bill => {
      const dueDate = new Date(bill.next_due_date);
      return dueDate >= today && dueDate <= weekFromNow && bill.status === 'active';
    });
  };

  // Get pending client requests
  const getPendingRequests = () => {
    return clientRequests.filter(req => req.status === 'pending' || req.status === 'in_progress');
  };

  // Get today's software queue
  const getTodaysQueue = () => {
    const today = new Date().toISOString().split('T')[0];
    return softwareQueue.filter(sw => sw.scheduled_date === today);
  };

  useEffect(() => {
    fetchData();
    // Check billing alerts on load
    checkBillingAlerts();
  }, []);

  return {
    clientRequests,
    softwareQueue,
    billingItems,
    backlinks,
    loading,
    processing,
    fetchData,
    submitClientRequest,
    generateDailySoftware,
    generateSeo,
    checkBillingAlerts,
    addBillingItem,
    getUpcomingBills,
    getPendingRequests,
    getTodaysQueue
  };
}
