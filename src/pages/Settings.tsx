import { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user, isSuperAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');

  // Settings state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const handleSave = () => {
    toast({
      title: 'Settings saved',
      description: 'Your settings have been updated successfully.',
    });
  };

  const handleForceLogout = () => {
    toast({
      title: 'All sessions logged out',
      description: 'All other sessions have been terminated.',
    });
  };

  const handleHardLock = () => {
    toast({
      variant: 'destructive',
      title: 'Panel Locked',
      description: 'The admin panel has been locked. Contact support to unlock.',
    });
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
            {isSuperAdmin && (
              <TabsTrigger value="resellers" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="h-4 w-4" />
                Resellers
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
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 border-2 border-primary/30">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-muted text-foreground text-xl">
                      {user?.email?.slice(0, 2).toUpperCase()}
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
                    <Input id="fullName" placeholder="John Doe" className="bg-muted/50 border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <Input id="email" type="email" value={user?.email || ''} disabled className="bg-muted/50 border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-foreground">Company Name</Label>
                    <Input id="company" placeholder="Acme Corp" className="bg-muted/50 border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">Phone</Label>
                    <Input id="phone" placeholder="+1 (555) 000-0000" className="bg-muted/50 border-border" />
                  </div>
                </div>

                <Button onClick={handleSave} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="mt-6 space-y-6">
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

          {/* Resellers Tab (Super Admin Only) */}
          {isSuperAdmin && (
            <TabsContent value="resellers" className="mt-6 space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-foreground">Reseller Management</CardTitle>
                  <CardDescription>Manage reseller accounts and permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-muted text-foreground">TS</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">TechStore Inc</p>
                          <p className="text-sm text-muted-foreground">techstore@example.com</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-muted text-foreground">RH</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">RetailHub</p>
                          <p className="text-sm text-muted-foreground">retailhub@example.com</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                        Pending
                      </Badge>
                    </div>
                  </div>
                  <Button className="mt-4 bg-orange-gradient hover:opacity-90 text-white gap-2">
                    <Users className="h-4 w-4" />
                    Add Reseller
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
