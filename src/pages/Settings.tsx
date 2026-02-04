import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Shield,
  Bell,
  Lock,
  LogOut,
  AlertTriangle,
  Smartphone,
  Save,
  Loader2,
  FileText,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { DeviceBindingCard } from '@/components/settings/DeviceBindingCard';

export default function Settings() {
  const { user, isSuperAdmin, signOut } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  // Settings state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
  });

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        company_name: profile.company_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleForceLogout = () => {
    toast.success('All other sessions have been terminated');
  };

  const handleHardLock = () => {
    toast.error('Admin panel has been locked. Contact support to unlock.');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Settings & Security
          </h2>
          <p className="text-muted-foreground">
            Manage your account and security preferences
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted">
            <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4" />
              Policies
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6 space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-foreground">Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6">
                      <Avatar className="h-20 w-20 border-2 border-primary/30">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-muted text-foreground text-xl">
                          {formData.full_name?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Button variant="outline" className="border-border">
                          Change Avatar
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          JPG, PNG, GIF up to 5MB
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
                        <Input 
                          id="fullName" 
                          placeholder="John Doe" 
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="bg-muted/50 border-border" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-foreground">Email</Label>
                        <Input id="email" type="email" value={user?.email || ''} disabled className="bg-muted/50 border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company" className="text-foreground">Company Name</Label>
                        <Input 
                          id="company" 
                          placeholder="Acme Corp" 
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          className="bg-muted/50 border-border" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-foreground">Phone</Label>
                        <Input 
                          id="phone" 
                          placeholder="+91 98765 43210" 
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="bg-muted/50 border-border" 
                        />
                      </div>
                    </div>

                    <Button onClick={handleSave} disabled={saving} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Changes
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="mt-6 space-y-6">
            {/* Device Binding Card */}
            <DeviceBindingCard />

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-foreground">Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Smartphone className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Authenticator App</p>
                      <p className="text-sm text-muted-foreground">
                        {twoFactorEnabled ? 'Enabled' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-foreground">Session Management</CardTitle>
                <CardDescription>Manage your active sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" onClick={handleForceLogout} className="gap-2 border-border">
                  <LogOut className="h-4 w-4" />
                  Force Logout All Sessions
                </Button>
                <p className="text-sm text-muted-foreground">
                  This will log out all devices except your current session.
                </p>
              </CardContent>
            </Card>

            {isSuperAdmin && (
              <Card className="glass-card border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Emergency Hard Lock
                  </CardTitle>
                  <CardDescription>Lock the entire admin panel immediately</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="destructive" onClick={handleHardLock} className="gap-2">
                    <Lock className="h-4 w-4" />
                    Activate Hard Lock
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Warning: This will lock the panel for all users. Contact support to unlock.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6 space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-foreground">Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
                  </div>
                  <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="mt-6 space-y-6">
            {/* No Refund Policy */}
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-sky-500" />
                  <CardTitle className="text-foreground">No Refund Policy</CardTitle>
                </div>
                <CardDescription>Digital product refund terms</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 rounded-lg border border-border p-4 bg-muted/30">
                  <div className="space-y-4 text-sm text-foreground">
                    <h4 className="font-semibold uppercase tracking-wide">No Refund Policy</h4>
                    <p>This is a digital product. Once access, demo, APK, or source files are delivered, they can be copied or used immediately. Because of this, <strong>refunds are not possible</strong>.</p>
                    
                    <h5 className="font-semibold">Key Points:</h5>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Digital delivery is instant and irreversible</li>
                      <li>Demo available before payment to test features</li>
                      <li>License activation happens immediately</li>
                      <li>Fair pricing without hidden charges</li>
                      <li>Support provided even after purchase</li>
                    </ul>

                    <p className="font-semibold text-primary">We ensure full demo access before purchase.</p>

                    <p className="text-xs text-muted-foreground">
                      By making a purchase, you acknowledge and agree to this policy. All payments are final.
                    </p>
                  </div>
                </ScrollArea>
                <div className="flex items-center gap-2 mt-4">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">Active Policy</span>
                </div>
              </CardContent>
            </Card>

            {/* Terms of Service */}
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-foreground">Terms of Service</CardTitle>
                </div>
                <CardDescription>Platform usage terms and conditions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 rounded-lg border border-border p-4 bg-muted/30">
                  <div className="space-y-4 text-sm text-foreground">
                    <h4 className="font-semibold uppercase tracking-wide">Terms of Service</h4>
                    
                    <h5 className="font-semibold">1. Acceptance of Terms</h5>
                    <p className="text-muted-foreground">By accessing or using SOFTWARE VALA services, you agree to be bound by these Terms of Service.</p>
                    
                    <h5 className="font-semibold">2. License Grant</h5>
                    <p className="text-muted-foreground">We grant you a non-exclusive, non-transferable license to use our software products according to your subscription type.</p>
                    
                    <h5 className="font-semibold">3. User Responsibilities</h5>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Maintain confidentiality of account credentials</li>
                      <li>Do not share license keys with unauthorized users</li>
                      <li>Use products only for lawful purposes</li>
                      <li>Do not reverse engineer or decompile products</li>
                    </ul>

                    <h5 className="font-semibold">4. Support & Updates</h5>
                    <p className="text-muted-foreground">Active license holders receive support and product updates during their subscription period.</p>

                    <h5 className="font-semibold">5. Termination</h5>
                    <p className="text-muted-foreground">We reserve the right to terminate access for violations of these terms without refund.</p>
                  </div>
                </ScrollArea>
                <div className="flex items-center gap-2 mt-4">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">Active Policy</span>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Policy */}
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cyan" />
                  <CardTitle className="text-foreground">Privacy Policy</CardTitle>
                </div>
                <CardDescription>How we collect and use your data</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 rounded-lg border border-border p-4 bg-muted/30">
                  <div className="space-y-4 text-sm text-foreground">
                    <h4 className="font-semibold uppercase tracking-wide">Privacy Policy</h4>
                    
                    <h5 className="font-semibold">1. Data Collection</h5>
                    <p className="text-muted-foreground">We collect information you provide directly: name, email, company name, and payment details.</p>
                    
                    <h5 className="font-semibold">2. Data Usage</h5>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Process transactions and manage your account</li>
                      <li>Provide customer support</li>
                      <li>Send product updates and security alerts</li>
                      <li>Improve our services</li>
                    </ul>

                    <h5 className="font-semibold">3. Data Security</h5>
                    <p className="text-muted-foreground">All data is encrypted in transit and at rest. We use industry-standard security measures.</p>

                    <h5 className="font-semibold">4. Data Sharing</h5>
                    <p className="text-muted-foreground">We do not sell your personal data. We may share with payment processors and legal authorities when required.</p>

                    <h5 className="font-semibold">5. Your Rights</h5>
                    <p className="text-muted-foreground">You can request access, correction, or deletion of your data by contacting support.</p>
                  </div>
                </ScrollArea>
                <div className="flex items-center gap-2 mt-4">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">Active Policy</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
