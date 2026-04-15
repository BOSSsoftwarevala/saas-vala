// Boss Settings Module - System configuration and preferences
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Globe,
  Bell,
  Palette,
  Database,
  CreditCard,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  Lock,
  Key,
  Mail,
  ToggleLeft,
  ToggleRight,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SystemSetting {
  id: string;
  key: string;
  value: string | boolean | number;
  category: 'general' | 'security' | 'notifications' | 'integrations' | 'billing';
  description: string;
  updated_at: string;
}

export default function BossSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Mock settings for now - in production, this would come from the database
      const mockSettings: SystemSetting[] = [
        {
          id: '1',
          key: 'site_name',
          value: 'SaaS VALA',
          category: 'general',
          description: 'The name of your SaaS platform',
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          key: 'site_description',
          value: 'AI-powered software marketplace',
          category: 'general',
          description: 'A brief description of your platform',
          updated_at: new Date().toISOString(),
        },
        {
          id: '3',
          key: 'maintenance_mode',
          value: false,
          category: 'general',
          description: 'Enable maintenance mode to disable public access',
          updated_at: new Date().toISOString(),
        },
        {
          id: '4',
          key: '2fa_enabled',
          value: true,
          category: 'security',
          description: 'Require two-factor authentication for all admin users',
          updated_at: new Date().toISOString(),
        },
        {
          id: '5',
          key: 'session_timeout',
          value: 30,
          category: 'security',
          description: 'Session timeout in minutes',
          updated_at: new Date().toISOString(),
        },
        {
          id: '6',
          key: 'email_notifications',
          value: true,
          category: 'notifications',
          description: 'Enable email notifications for important events',
          updated_at: new Date().toISOString(),
        },
        {
          id: '7',
          key: 'slack_webhook',
          value: '',
          category: 'integrations',
          description: 'Slack webhook URL for notifications',
          updated_at: new Date().toISOString(),
        },
        {
          id: '8',
          key: 'stripe_secret_key',
          value: 'sk_live_xxxxxxxxxxxx',
          category: 'billing',
          description: 'Stripe secret key for payment processing',
          updated_at: new Date().toISOString(),
        },
      ];

      setSettings(mockSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    setSettings(prev =>
      prev.map(s =>
        s.key === key ? { ...s, value } : s
      )
    );
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // In production, this would save to the database
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'general':
        return <Globe className="w-5 h-5" />;
      case 'security':
        return <Shield className="w-5 h-5" />;
      case 'notifications':
        return <Bell className="w-5 h-5" />;
      case 'integrations':
        return <Database className="w-5 h-5" />;
      case 'billing':
        return <CreditCard className="w-5 h-5" />;
      default:
        return <SettingsIcon className="w-5 h-5" />;
    }
  };

  const filteredSettings = settings.filter(s => s.category === activeTab);

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Database },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">System Settings</h1>
          <p className="text-slate-400">Configure system-wide preferences and integrations</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-slate-700/50">
              {getCategoryIcon(activeTab)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white capitalize">{activeTab} Settings</h2>
              <p className="text-sm text-slate-400">Configure {activeTab} preferences</p>
            </div>
          </div>

          {filteredSettings.length === 0 ? (
            <div className="text-center py-12">
              <SettingsIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No settings found</h3>
              <p className="text-slate-400">Settings for this category will appear here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredSettings.map((setting) => (
                <div
                  key={setting.id}
                  className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {setting.key.includes('password') || setting.key.includes('key') ? (
                          <Lock className="w-4 h-4 text-slate-400" />
                        ) : setting.key.includes('email') ? (
                          <Mail className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Sliders className="w-4 h-4 text-slate-400" />
                        )}
                        <h3 className="font-medium text-white capitalize">{setting.key.replace(/_/g, ' ')}</h3>
                      </div>
                      <p className="text-sm text-slate-400 mb-4">{setting.description}</p>

                      {typeof setting.value === 'boolean' ? (
                        <button
                          onClick={() => updateSetting(setting.key, !setting.value)}
                          className="flex items-center gap-2"
                        >
                          {setting.value ? (
                            <ToggleRight className="w-6 h-6 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                          )}
                          <span className="text-sm text-slate-300">{setting.value ? 'Enabled' : 'Disabled'}</span>
                        </button>
                      ) : typeof setting.value === 'number' ? (
                        <input
                          type="number"
                          value={setting.value}
                          onChange={(e) => updateSetting(setting.key, Number(e.target.value))}
                          className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-32"
                        />
                      ) : (
                        <input
                          type={setting.key.includes('password') || setting.key.includes('key') ? 'password' : 'text'}
                          value={setting.value as string}
                          onChange={(e) => updateSetting(setting.key, e.target.value)}
                          className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full max-w-md"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-500">
                    <span>Last updated:</span>
                    <span>{new Date(setting.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors text-left">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <div>
                  <span className="text-sm font-medium text-white">Clear Cache</span>
                  <p className="text-xs text-slate-400">Clear all system caches</p>
                </div>
              </button>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors text-left">
                <Database className="w-5 h-5 text-green-400" />
                <div>
                  <span className="text-sm font-medium text-white">Run Database Migration</span>
                  <p className="text-xs text-slate-400">Execute pending migrations</p>
                </div>
              </button>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors text-left">
                <Shield className="w-5 h-5 text-purple-400" />
                <div>
                  <span className="text-sm font-medium text-white">Reset API Keys</span>
                  <p className="text-xs text-slate-400">Generate new API keys</p>
                </div>
              </button>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors text-left">
                <CheckCircle className="w-5 h-5 text-yellow-400" />
                <div>
                  <span className="text-sm font-medium text-white">Verify Integrations</span>
                  <p className="text-xs text-slate-400">Check all external services</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
