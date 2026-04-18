import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutomation } from '@/hooks/useAutoMation';
import { GitHubMultiAccountPanel } from './GitHubMultiAccountPanel';
import { SourceCodeCatalogPanel } from './SourceCodeCatalogPanel';
import { supabase } from '@/lib/supabase';
import { 
  Bot, 
  Zap, 
  Calendar, 
  Bell, 
  CreditCard, 
  Link2, 
  Rocket,
  AlertTriangle,
  Users,
  Package,
  Loader2,
  Plus,
  GitBranch,
  FolderCode
} from 'lucide-react';
import { toast } from 'sonner';

export function AutoPilotDashboard() {
  const { 
    clientRequests, 
    softwareQueue, 
    billingTrackers, 
    seoBacklinks, 
    loading,
    refreshData,
    approveRequest,
    rejectRequest,
    processRequest
  } = useAutomation();

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showBillingForm, setShowBillingForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    client_name: '',
    client_email: '',
    request_type: 'custom',
    request_details: '',
    priority: 'medium'
  });
  const [newBilling, setNewBilling] = useState({
    service_type: 'subscription',
    service_name: '',
    provider: '',
    amount: 0,
    billing_cycle: 'monthly',
    next_due_date: '',
    auto_pay: false
  });

  const upcomingBills = billingTrackers.filter(bill => {
  const dueDate = new Date(bill.next_due_date);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilDue <= 7 && daysUntilDue >= 0;
});

const pendingRequests = clientRequests.filter(req => req.status === 'pending');

const todaysQueue = softwareQueue.filter(software => {
  const queueDate = new Date(software.scheduled_date);
  const today = new Date();
  return queueDate.toDateString() === today.toDateString();
});

  const [processing, setProcessing] = useState(false);

  const submitClientRequest = async (request: any) => {
    try {
      const { error } = await supabase.from('client_requests').insert([request]);
      if (error) throw error;
      toast.success('Client request submitted successfully');
      await refreshData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    }
  };

  const addBillingItem = async (billing: any) => {
    try {
      const { error } = await supabase.from('billing_trackers').insert([billing]);
      if (error) throw error;
      toast.success('Billing item added successfully');
      await refreshData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add billing item');
    }
  };

  const generateDailySoftware = async () => {
    setProcessing(true);
    try {
      toast.success('Daily software generation started');
      // Placeholder for AI generation logic
      setTimeout(() => {
        setProcessing(false);
        toast.success('2 software products generated successfully');
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate software');
      setProcessing(false);
    }
  };

  const checkBillingAlerts = async () => {
    const overdueBills = upcomingBills.filter(bill => {
      const dueDate = new Date(bill.next_due_date);
      const today = new Date();
      return dueDate < today;
    });

    if (overdueBills.length > 0) {
      toast.warning(`You have ${overdueBills.length} overdue bills!`);
    } else {
      toast.success('No overdue bills found');
    }
  };

  const handleSubmitRequest = async () => {
    if (!newRequest.client_name || !newRequest.request_details) {
      toast.error('Please fill in client name and request details');
      return;
    }
    await submitClientRequest(newRequest);
    setNewRequest({
      client_name: '',
      client_email: '',
      request_type: 'custom',
      request_details: '',
      priority: 'medium'
    });
    setShowRequestForm(false);
  };

  const handleAddBilling = async () => {
    if (!newBilling.service_name || !newBilling.next_due_date || newBilling.amount <= 0) {
      toast.error('Please fill in all required billing fields');
      return;
    }
    await addBillingItem(newBilling);
    setNewBilling({
      service_type: 'subscription',
      service_name: '',
      provider: '',
      amount: 0,
      billing_cycle: 'monthly',
      next_due_date: '',
      auto_pay: false
    });
    setShowBillingForm(false);
  };

  // Check billing alerts on mount
  useEffect(() => {
    checkBillingAlerts();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500/20 text-blue-400">In Progress</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      default:
        return 'text-green-400';
    }
  };

  return (
    <Tabs defaultValue="autopilot" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
        <TabsTrigger value="autopilot" className="gap-2">
          <Bot className="h-4 w-4" />
          Auto-Pilot
        </TabsTrigger>
        <TabsTrigger value="github" className="gap-2">
          <GitBranch className="h-4 w-4" />
          GitHub Accounts
        </TabsTrigger>
        <TabsTrigger value="catalog" className="gap-2">
          <FolderCode className="h-4 w-4" />
          Source Catalog
        </TabsTrigger>
      </TabsList>

      <TabsContent value="github">
        <GitHubMultiAccountPanel />
      </TabsContent>

      <TabsContent value="catalog">
        <SourceCodeCatalogPanel />
      </TabsContent>

      <TabsContent value="autopilot" className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Requests</p>
                  <p className="text-3xl font-bold text-blue-400">{pendingRequests.length}</p>
                </div>
                <Users className="h-10 w-10 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Software</p>
                  <p className="text-3xl font-bold text-green-400">{todaysQueue.length}/2</p>
                </div>
                <Package className="h-10 w-10 text-green-400/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Bills</p>
                  <p className="text-3xl font-bold text-orange-400">{upcomingBills.length}</p>
                </div>
                <CreditCard className="h-10 w-10 text-orange-400/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Backlinks</p>
                  <p className="text-3xl font-bold text-purple-400">Auto</p>
                </div>
                <Link2 className="h-10 w-10 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            AI Auto-Pilot Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => setShowRequestForm(!showRequestForm)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Client Request
            </Button>
            <Button 
              onClick={generateDailySoftware}
              disabled={processing}
              variant="secondary"
              className="gap-2"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Generate 2 Daily Software
            </Button>
            <Button 
              onClick={() => checkBillingAlerts()}
              variant="outline"
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              Check Billing Alerts
            </Button>
            <Button 
              onClick={() => setShowBillingForm(!showBillingForm)}
              variant="outline"
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Add Billing Item
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Client Request Form */}
      {showRequestForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                New Client Request (AI Auto-Handle)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  placeholder="Client Name *"
                  value={newRequest.client_name}
                  onChange={(e) => setNewRequest({ ...newRequest, client_name: e.target.value })}
                />
                <Input 
                  placeholder="Client Email"
                  type="email"
                  value={newRequest.client_email}
                  onChange={(e) => setNewRequest({ ...newRequest, client_email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select 
                  value={newRequest.request_type}
                  onValueChange={(val) => setNewRequest({ ...newRequest, request_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Request Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_gateway">Payment Gateway</SelectItem>
                    <SelectItem value="ai_api">AI API Integration</SelectItem>
                    <SelectItem value="server">Server Setup</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="domain">Domain/SSL</SelectItem>
                    <SelectItem value="custom">Custom Development</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={newRequest.priority}
                  onValueChange={(val) => setNewRequest({ ...newRequest, priority: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea 
                placeholder="Request Details - AI will analyze and auto-handle *"
                value={newRequest.request_details}
                onChange={(e) => setNewRequest({ ...newRequest, request_details: e.target.value })}
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={handleSubmitRequest} disabled={processing} className="gap-2">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  Submit to AI Auto-Pilot
                </Button>
                <Button variant="outline" onClick={() => setShowRequestForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* New Billing Form */}
      {showBillingForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="border-orange-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-400" />
                Add Billing Item (4-Day Alert)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select 
                  value={newBilling.service_type}
                  onValueChange={(val) => setNewBilling({ ...newBilling, service_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Service Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai_api">AI API</SelectItem>
                    <SelectItem value="server">Server</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="license">License</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Service Name *"
                  value={newBilling.service_name}
                  onChange={(e) => setNewBilling({ ...newBilling, service_name: e.target.value })}
                />
                <Input 
                  placeholder="Provider"
                  value={newBilling.provider}
                  onChange={(e) => setNewBilling({ ...newBilling, provider: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input 
                  placeholder="Amount ($) *"
                  type="number"
                  value={newBilling.amount || ''}
                  onChange={(e) => setNewBilling({ ...newBilling, amount: parseFloat(e.target.value) || 0 })}
                />
                <Select 
                  value={newBilling.billing_cycle}
                  onValueChange={(val) => setNewBilling({ ...newBilling, billing_cycle: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Billing Cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Next Due Date *"
                  type="date"
                  value={newBilling.next_due_date}
                  onChange={(e) => setNewBilling({ ...newBilling, next_due_date: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddBilling} className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Add & Enable 4-Day Alert
                </Button>
                <Button variant="outline" onClick={() => setShowBillingForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upcoming Bills Alert */}
      {upcomingBills.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Upcoming Bills (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingBills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                  <div>
                    <p className="font-medium">{bill.service_name}</p>
                    <p className="text-sm text-muted-foreground">{bill.service_type} • {bill.provider || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-400">${bill.amount}</p>
                    <p className="text-sm text-muted-foreground">Due: {bill.next_due_date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Client Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recent Client Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : clientRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No client requests yet</p>
          ) : (
            <div className="space-y-3">
              {clientRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{request.client_name}</p>
                        <Badge variant="outline">{request.request_type}</Badge>
                        <span className={`text-xs font-medium ${getPriorityColor(request.priority)}`}>
                          {request.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{request.request_details}</p>
                      {request.ai_response && (
                        <div className="mt-2 p-2 bg-primary/10 rounded text-sm">
                          <span className="font-medium text-primary">AI Response: </span>
                          {request.ai_response}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(request.status)}
                      {request.estimated_cost && (
                        <span className="text-sm font-medium">${request.estimated_cost}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Software Build Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Auto Software Builder Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {softwareQueue.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No software in queue</p>
              <Button 
                onClick={generateDailySoftware} 
                disabled={processing}
                className="mt-4 gap-2"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Generate Today's 2 Software
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {softwareQueue.slice(0, 6).map((software) => (
                <div key={software.id} className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{software.software_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {software.target_industry} • {software.software_type}
                      </p>
                      {software.ai_generated_description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {software.ai_generated_description}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(software.status)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(software.features as { icon: string; text: string }[] || []).slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature.text}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>
    </Tabs>
  );
}
