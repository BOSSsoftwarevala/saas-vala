import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield, Key, LogIn, LayoutDashboard, Users, Package, FileText,
  Settings, Lock, CheckCircle2, Smartphone, Database, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

type AppScreen = 'splash' | 'license' | 'login' | 'dashboard';

const STORAGE_PREFIX = 'sv_offline_';

function getLocal(key: string) {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) || 'null'); } catch { return null; }
}
function setLocal(key: string, value: any) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}

// Simulated offline SQLite tables
function initLocalDb() {
  if (!getLocal('db_init')) {
    setLocal('users', [{ id: 1, name: 'Admin', email: 'admin@softwarevala.com', role: 'admin' }]);
    setLocal('products', []);
    setLocal('orders', []);
    setLocal('transactions', []);
    setLocal('settings', { company: 'Software Vala', theme: 'dark' });
    setLocal('db_init', true);
  }
}

export default function OfflineAppTemplate() {
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [licenseKey, setLicenseKey] = useState('');
  const [_licenseValid, setLicenseValid] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isOnline] = useState(navigator.onLine);

  useEffect(() => {
    initLocalDb();
    // Check stored license
    const stored = getLocal('license');
    if (stored?.key && stored?.activated) {
      setLicenseValid(true);
    }
    // Splash auto-advance
    const t = setTimeout(() => {
      setScreen(stored?.activated ? 'login' : 'license');
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  const activateLicense = () => {
    if (!licenseKey.trim()) { toast.error('Enter a license key'); return; }
    // Validate SV-XXXX format
    if (!/^SV-\d{4}-[A-Z]{2,6}-[A-Z0-9]{3,6}$/i.test(licenseKey.trim())) {
      toast.error('Invalid format. Expected: SV-2026-XXXX-XXX');
      return;
    }
    // Device binding (simulated)
    const deviceId = navigator.userAgent.slice(0, 40) + '-' + window.screen.width;
    setLocal('license', {
      key: licenseKey.trim(),
      activated: true,
      device_id: deviceId,
      activated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
    });
    setLicenseValid(true);
    toast.success('✅ License activated! Device bound.');
    setScreen('login');
  };

  const handleLogin = () => {
    const users = getLocal('users') || [];
    const valid = loginEmail === 'admin@softwarevala.com' && loginPass === 'admin123';
    if (valid || users.some((u: any) => u.email === loginEmail)) {
      setLocal('session', { email: loginEmail, logged_in: true, at: new Date().toISOString() });
      toast.success('Welcome back!');
      setScreen('dashboard');
    } else {
      toast.error('Invalid credentials. Try admin@softwarevala.com / admin123');
    }
  };

  const license = getLocal('license');
  const dbUsers = getLocal('users') || [];
  const dbOrders = getLocal('orders') || [];
  const dbProducts = getLocal('products') || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnimatePresence mode="wait">
        {/* ── SPLASH ── */}
        {screen === 'splash' && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen gap-6"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-24 h-24 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', boxShadow: '0 0 40px rgba(37,99,235,0.4)' }}
            >
              <Smartphone className="h-12 w-12 text-white" />
            </motion.div>
            <h1 className="text-3xl font-black">Software Vala™</h1>
            <p className="text-sm text-muted-foreground">Offline Enterprise Software</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isOnline ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-yellow-500" />}
              {isOnline ? 'Online' : 'Offline Mode'}
            </div>
            <motion.div
              className="w-32 h-1 rounded-full overflow-hidden bg-muted"
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #2563eb, #4f46e5)' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.2 }}
              />
            </motion.div>
          </motion.div>
        )}

        {/* ── LICENSE KEY ── */}
        {screen === 'license' && (
          <motion.div
            key="license"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex items-center justify-center min-h-screen p-6"
          >
            <Card className="w-full max-w-md border-primary/20">
              <CardHeader className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
                  <Key className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl font-black">License Activation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter your Software Vala™ license key to unlock this application.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="SV-2026-XXXX-XXX"
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                  className="text-center font-mono text-lg tracking-wider h-12"
                />
                <Button
                  className="w-full h-12 font-black text-sm gap-2"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
                  onClick={activateLicense}
                >
                  <Shield className="h-4 w-4" />
                  ACTIVATE LICENSE
                </Button>
                <div className="text-center space-y-1">
                  <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    <Lock className="h-3 w-3" /> Device-bound • Encrypted • 30-day license
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Purchase at <span className="text-primary font-bold">saasvala.com</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── LOGIN ── */}
        {screen === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex items-center justify-center min-h-screen p-6"
          >
            <Card className="w-full max-w-md">
              <CardHeader className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
                  <LogIn className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl font-black">Sign In</CardTitle>
                {license && (
                  <p className="text-[10px] text-green-500 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Licensed: {license.key}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Email"
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                />
                <Input
                  placeholder="Password"
                  type="password"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                />
                <Button
                  className="w-full h-11 font-black text-sm gap-2"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
                  onClick={handleLogin}
                >
                  <LogIn className="h-4 w-4" /> SIGN IN
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  Default: admin@softwarevala.com / admin123
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── DASHBOARD ── */}
        {screen === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            {/* Top Bar */}
            <header className="sticky top-0 z-30 h-14 border-b border-border/40 bg-background/90 backdrop-blur-xl flex items-center justify-between px-4">
              <h1 className="font-black text-sm flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                Software Vala™ Dashboard
              </h1>
              <div className="flex items-center gap-2 text-xs">
                {isOnline ? (
                  <span className="flex items-center gap-1 text-green-500"><Wifi className="h-3 w-3" /> Online</span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-500"><WifiOff className="h-3 w-3" /> Offline</span>
                )}
                <span className="text-muted-foreground">|</span>
                <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="h-3 w-3" /> Licensed</span>
              </div>
            </header>

            <main className="p-4 space-y-4 max-w-4xl mx-auto">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Users', value: dbUsers.length, icon: Users, color: 'text-blue-500' },
                  { label: 'Products', value: dbProducts.length, icon: Package, color: 'text-green-500' },
                  { label: 'Orders', value: dbOrders.length, icon: FileText, color: 'text-yellow-500' },
                  { label: 'Database', value: 'SQLite', icon: Database, color: 'text-purple-500' },
                ].map(s => (
                  <Card key={s.label} className="border-border/40">
                    <CardContent className="p-4 flex items-center gap-3">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                      <div>
                        <p className="text-xl font-black">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Modules */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Application Modules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Users', icon: Users, desc: 'Manage users & roles' },
                      { label: 'Products', icon: Package, desc: 'Product catalog' },
                      { label: 'Orders', icon: FileText, desc: 'Order management' },
                      { label: 'Reports', icon: LayoutDashboard, desc: 'Analytics & reports' },
                      { label: 'License', icon: Key, desc: 'License info' },
                      { label: 'Settings', icon: Settings, desc: 'App configuration' },
                    ].map(m => (
                      <button
                        key={m.label}
                        className="flex items-center gap-3 p-4 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
                        onClick={() => toast.info(`${m.label} module — fully offline`)}
                      >
                        <m.icon className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-bold">{m.label}</p>
                          <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* License Info */}
              {license && (
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-bold text-sm text-green-500">License Active</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{license.key}</p>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">
                      <p>Activated: {new Date(license.activated_at).toLocaleDateString()}</p>
                      <p>Expires: {new Date(license.expires_at).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <p className="text-[10px] text-center text-muted-foreground py-4">
                Powered by Software Vala™ — 100% Offline • SQLite • License Protected
              </p>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
