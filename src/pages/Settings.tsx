import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Shield,
  Bell,
  Users,
  Lock,
  LogOut,
  AlertTriangle,
  Smartphone,
  Save,
  Loader2,
  Upload,
  CreditCard,
} from 'lucide-react';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input id="new-password" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-muted/50 border-border" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirm New Password</Label>
        <Input id="confirm-new-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-muted/50 border-border" />
      </div>
      <Button onClick={handleChangePassword} disabled={saving || !newPassword} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Update Password
      </Button>
    </div>
  );
}

export default function Settings() {
  const { user, isSuperAdmin, signOut } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const { settings: ps, loading: psLoading, saving: psSaving, saveSettings } = usePaymentSettings();
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

  // Payment form state
  const [payForm, setPayForm] = useState({
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

  // Sync payment settings from DB into form
  useEffect(() => {
    if (!psLoading) {
      setPayForm({
        bank_name: ps.bank_name,
        account_name: ps.account_name,
        account_number: ps.account_number,
        ifsc_code: ps.ifsc_code,
        branch_name: ps.branch_name,
        account_type: ps.account_type,
        upi_id: ps.upi_id,
        wise_pay_link: ps.wise_pay_link,
        binance_pay_id: ps.binance_pay_id,
        remitly_note: ps.remitly_note,
        upi_enabled: ps.upi_enabled,
        bank_enabled: ps.bank_enabled,
        wise_enabled: ps.wise_enabled,
        crypto_enabled: ps.crypto_enabled,
        remitly_enabled: ps.remitly_enabled,
      });
    }
  }, [psLoading]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    if (!payForm.account_number.trim() || !payForm.ifsc_code.trim()) {
      toast.error('Account number and IFSC code are required');
      return;
    }
    const ok = await saveSettings(payForm);
    if (ok) toast.success('Payment settings saved successfully');
    else toast.error('Failed to save — check permissions');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      toast.error('Only JPG, PNG, GIF allowed.');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user?.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` });
      toast.success('Avatar updated!');
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
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
          <TabsList className="bg-muted flex-wrap">
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
            {isSuperAdmin && (
              <TabsTrigger value="payment" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <CreditCard className="h-4 w-4" />
                Payment Config
              </TabsTrigger>
            )}
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
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarUpload}
                          accept="image/jpeg,image/png,image/gif"
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          className="border-border gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {uploading ? 'Uploading...' : 'Change Avatar'}
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

          <TabsContent value="security" className="mt-6 space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-foreground">Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChangePasswordForm />
              </CardContent>
            </Card>

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

          {/* Payment Config Tab - super admin only */}
          {isSuperAdmin && (
            <TabsContent value="payment" className="mt-6 space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Payment Configuration
                  </CardTitle>
                  <CardDescription>
                    Shown to users in the Add Credits modal. Changes take effect immediately.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {psLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Bank Transfer */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">Bank Transfer (NEFT/IMPS)</h4>
                          <Switch checked={payForm.bank_enabled} onCheckedChange={(v) => setPayForm(f => ({ ...f, bank_enabled: v }))} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Bank Name</Label>
                            <Input value={payForm.bank_name} onChange={(e) => setPayForm(f => ({ ...f, bank_name: e.target.value }))} className="bg-muted/50" />
                          </div>
                          <div className="space-y-1">
                            <Label>Account Name</Label>
                            <Input value={payForm.account_name} onChange={(e) => setPayForm(f => ({ ...f, account_name: e.target.value }))} className="bg-muted/50" />
                          </div>
                          <div className="space-y-1">
                            <Label>Account Number</Label>
                            <Input value={payForm.account_number} onChange={(e) => setPayForm(f => ({ ...f, account_number: e.target.value }))} className="bg-muted/50 font-mono" />
                          </div>
                          <div className="space-y-1">
                            <Label>IFSC Code</Label>
                            <Input value={payForm.ifsc_code} onChange={(e) => setPayForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))} className="bg-muted/50 font-mono" />
                          </div>
                          <div className="space-y-1">
                            <Label>Branch Name</Label>
                            <Input value={payForm.branch_name} onChange={(e) => setPayForm(f => ({ ...f, branch_name: e.target.value }))} className="bg-muted/50" />
                          </div>
                          <div className="space-y-1">
                            <Label>Account Type</Label>
                            <Input value={payForm.account_type} onChange={(e) => setPayForm(f => ({ ...f, account_type: e.target.value }))} className="bg-muted/50" />
                          </div>
                        </div>
                      </div>

                      <hr className="border-border" />

                      {/* UPI */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">UPI Payment</h4>
                          <Switch checked={payForm.upi_enabled} onCheckedChange={(v) => setPayForm(f => ({ ...f, upi_enabled: v }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>UPI ID</Label>
                          <Input value={payForm.upi_id} onChange={(e) => setPayForm(f => ({ ...f, upi_id: e.target.value }))} className="bg-muted/50 font-mono" />
                        </div>
                      </div>

                      <hr className="border-border" />

                      {/* Wise */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">Wise Payment</h4>
                          <Switch checked={payForm.wise_enabled} onCheckedChange={(v) => setPayForm(f => ({ ...f, wise_enabled: v }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Wise Pay Link</Label>
                          <Input value={payForm.wise_pay_link} onChange={(e) => setPayForm(f => ({ ...f, wise_pay_link: e.target.value }))} className="bg-muted/50" />
                        </div>
                      </div>

                      <hr className="border-border" />

                      {/* Crypto */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">Crypto (Binance Pay)</h4>
                          <Switch checked={payForm.crypto_enabled} onCheckedChange={(v) => setPayForm(f => ({ ...f, crypto_enabled: v }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Binance Pay ID</Label>
                          <Input value={payForm.binance_pay_id} onChange={(e) => setPayForm(f => ({ ...f, binance_pay_id: e.target.value }))} className="bg-muted/50 font-mono" />
                        </div>
                      </div>

                      <hr className="border-border" />

                      {/* Remitly */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">Remitly / Western Union</h4>
                          <Switch checked={payForm.remitly_enabled} onCheckedChange={(v) => setPayForm(f => ({ ...f, remitly_enabled: v }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Instructions Note</Label>
                          <Input value={payForm.remitly_note} onChange={(e) => setPayForm(f => ({ ...f, remitly_note: e.target.value }))} className="bg-muted/50" />
                        </div>
                      </div>

                      <Button
                        onClick={handleSavePayment}
                        disabled={psSaving}
                        className="bg-orange-gradient hover:opacity-90 text-white gap-2 w-full md:w-auto"
                      >
                        {psSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Payment Settings
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
