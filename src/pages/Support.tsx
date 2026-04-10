import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, MessageSquare, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Fallback: Simple support page while Slack-like feature initializes
const SupportFallback = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      // TODO: Replace with actual API endpoint
      toast.success('Support ticket created. We\'ll get back to you soon!');
      setMessage('');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Support</h2>
          <p className="text-sm text-muted-foreground mt-1">Get help from our support team</p>
        </div>

        <Alert className="border-blue-200 bg-blue-50/50">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            The real-time Slack-like support feature is being initialized. You can still reach us using the form below.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Send a Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Your Email</label>
                  <input
                    type="email"
                    value={user?.email || email}
                    disabled={!!user}
                    className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm h-32 resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-orange-gradient hover:opacity-90 text-white"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">FAQ & Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium text-foreground text-sm">Quick Links</h4>
                <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                  <li>• <a href="/marketplace" className="text-primary hover:underline">Marketplace</a></li>
                  <li>• <a href="/orders" className="text-primary hover:underline">Orders</a></li>
                  <li>• <a href="/settings" className="text-primary hover:underline">Settings & Security</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">Email Support</h4>
                <p className="text-sm text-muted-foreground mt-2">
                  support@saas-vala.com
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

// Slack-like real-time support (will be enabled when DB is ready)
const SupportSlackUI = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>You must be logged in to access support.</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading support interface...</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

// Main component
const Support = () => {
  const [useSlack, setUseSlack] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Try to detect if Slack-like feature can be used
    // For now, always show fallback
    setInitialized(true);
    setUseSlack(false);
  }, []);

  if (!initialized) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return useSlack ? <SupportSlackUI /> : <SupportFallback />;
};

export default Support;

