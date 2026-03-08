import { useState, useEffect } from 'react';
import { SectionSlider } from '@/components/marketplace/SectionSlider';
import { SectionHeader } from '@/components/marketplace/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Star, ExternalLink, Download, KeyRound, CheckCircle2, Lock, ShieldCheck, Play, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PRODUCTS = [
  { id: 'hotel-apk-1', name: 'Booking.com Clone', demoFolder: 'booking-hotel', repo: 'https://github.com/saasvala/booking-hotel-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Hotel listing and room booking platform with availability calendar.', features: ['Hotel Listings', 'Room Booking', 'Availability Calendar', 'Guest Reviews', 'Payment Gateway', 'Property Dashboard', 'Booking Management'] },
  { id: 'hotel-apk-2', name: 'Airbnb Rental Clone', demoFolder: 'airbnb-rental', repo: 'https://github.com/saasvala/airbnb-rental-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Vacation rental and property sharing marketplace.', features: ['Hotel Listings', 'Room Booking', 'Availability Calendar', 'Guest Reviews', 'Payment Gateway', 'Property Dashboard', 'Booking Management'] },
  { id: 'hotel-apk-3', name: 'Agoda Hotel Clone', demoFolder: 'agoda-hotel', repo: 'https://github.com/saasvala/agoda-hotel-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Hotel booking platform with guest reviews and payment integration.', features: ['Hotel Listings', 'Room Booking', 'Availability Calendar', 'Guest Reviews', 'Payment Gateway', 'Property Dashboard', 'Booking Management'] },
  { id: 'hotel-apk-4', name: 'OYO Rooms Clone', demoFolder: 'oyo-hotel', repo: 'https://github.com/saasvala/oyo-hotel-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Budget hotel booking and property management platform.', features: ['Hotel Listings', 'Room Booking', 'Availability Calendar', 'Guest Reviews', 'Payment Gateway', 'Property Dashboard', 'Booking Management'] },
  { id: 'hotel-apk-5', name: 'Expedia Travel Clone', demoFolder: 'expedia-travel', repo: 'https://github.com/saasvala/expedia-travel-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Travel and hotel booking marketplace with property dashboard.', features: ['Hotel Listings', 'Room Booking', 'Availability Calendar', 'Guest Reviews', 'Payment Gateway', 'Property Dashboard', 'Booking Management'] },
];

const VALID_KEYS = ['HOTEL-APK-2026-001', 'HOTEL-APK-2026-002', 'HOTEL-APK-2026-003', 'HOTEL-PWA-2026-001', 'HOSPITALITY-APK-2026-001'];
const PFX = 'hotel-pwa';
const LICENSE_DAYS = 30;

const isLicenseValid = () => {
  try {
    const lic = JSON.parse(localStorage.getItem(`${PFX}-license`) || 'null');
    if (!lic) return { valid: false, expired: false, daysLeft: 0 };
    const diff = new Date(lic.expiry).getTime() - Date.now();
    return { valid: diff > 0, expired: diff <= 0, daysLeft: Math.max(0, Math.ceil(diff / 86400000)) };
  } catch { return { valid: false, expired: false, daysLeft: 0 }; }
};

export default function HospitalityPwa() {
  const [licenseState, setLicenseState] = useState(isLicenseValid);
  const [wishlist, setWishlist] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(`${PFX}-wishlist`) || '[]'); } catch { return []; } });
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [demoProduct, setDemoProduct] = useState<typeof PRODUCTS[0] | null>(null);

  useEffect(() => { localStorage.setItem(`${PFX}-products`, JSON.stringify(PRODUCTS)); }, []);

  const toggleWish = (id: string) => {
    const next = wishlist.includes(id) ? wishlist.filter(x => x !== id) : [...wishlist, id];
    setWishlist(next); localStorage.setItem(`${PFX}-wishlist`, JSON.stringify(next));
    toast.success(next.includes(id) ? 'Added to wishlist' : 'Removed from wishlist');
  };

  const activate = () => {
    if (VALID_KEYS.includes(keyInput.trim().toUpperCase())) {
      const now = new Date();
      const expiry = new Date(now.getTime() + LICENSE_DAYS * 86400000);
      const lic = { key: keyInput.trim().toUpperCase(), activated: now.toISOString(), expiry: expiry.toISOString() };
      localStorage.setItem(`${PFX}-license`, JSON.stringify(lic));
      localStorage.setItem(`${PFX}-activated`, 'true');
      setLicenseState({ valid: true, expired: false, daysLeft: LICENSE_DAYS });
      setShowKey(false); setKeyInput('');
      toast.success(`🎉 License activated! Valid for ${LICENSE_DAYS} days. All 5 Hospitality software demos unlocked.`);
    } else toast.error('Invalid license key.');
  };

  const handleMasterDownload = () => {
    if (!licenseState.valid) { setShowKey(true); return; }
    const lic = JSON.parse(localStorage.getItem(`${PFX}-license`) || '{}');
    const blob = new Blob([JSON.stringify({ bundle: 'SaaS VALA Hospitality & Hotel Booking Systems Master Copy', version: '2026.1', row: 11, license: lic, products: PRODUCTS.map(p => ({ name: p.name, repo: p.repo, features: p.features, demoFolder: p.demoFolder })), generatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'saas-vala-hospitality-master-copy.json'; a.click(); URL.revokeObjectURL(u);
    toast.success('Master Copy downloaded!');
  };

  const openLocalDemo = (product: typeof PRODUCTS[0]) => {
    if (!licenseState.valid) { setShowKey(true); return; }
    setDemoProduct(product);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-primary">SaaS VALA</h1><p className="text-xs text-muted-foreground">Hospitality & Hotel Booking Systems — Offline PWA</p></div>
        <div className="flex items-center gap-2">
          {licenseState.valid && <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary"><Clock className="h-3 w-3" />{licenseState.daysLeft}d left</Badge>}
          {licenseState.valid ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1"><ShieldCheck className="h-3 w-3" /> Licensed</Badge> : licenseState.expired ? <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1"><AlertTriangle className="h-3 w-3" /> Expired</Badge> : <Button size="sm" variant="outline" onClick={() => setShowKey(true)} className="gap-1 text-xs"><KeyRound className="h-3 w-3" /> Activate</Button>}
        </div>
      </header>
      <main className="py-6 space-y-6">
        {!licenseState.valid && (
          <div className={cn("mx-4 md:mx-8 p-4 rounded-lg border flex items-center justify-between gap-4 flex-wrap", licenseState.expired ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5")}>
            <div className="flex items-center gap-3">{licenseState.expired ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Lock className="h-5 w-5 text-primary" />}<div><p className="font-semibold text-sm">{licenseState.expired ? 'License Expired — Enter a new key to continue' : 'Activate to unlock all 5 Hospitality Software Demos'}</p><p className="text-xs text-muted-foreground">Enter license key: HOTEL-APK-2026-001</p></div></div>
            <Button size="sm" onClick={() => setShowKey(true)} className="gap-1"><KeyRound className="h-3 w-3" /> Enter Key</Button>
          </div>
        )}
        {licenseState.valid && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-green-500/30 bg-green-500/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><div><p className="font-semibold text-sm">Master Copy Ready — All 5 Hospitality Software Unlocked</p><p className="text-xs text-muted-foreground">License valid for {licenseState.daysLeft} days · Download the complete offline bundle</p></div></div>
            <Button size="sm" onClick={handleMasterDownload} className="gap-1 bg-green-600 hover:bg-green-700 text-white"><Download className="h-3 w-3" /> Download Master Copy</Button>
          </div>
        )}
        <SectionHeader icon="🏨" title="Hospitality & Hotel Booking Systems" subtitle="Top 5 Hospitality & Hotel Booking Software Clones — Offline Ready." badge="ROW 11" badgeVariant="hot" totalCount={5} />
        <SectionSlider>
          {PRODUCTS.map((p, i) => (
            <div key={p.id} className="min-w-[280px] max-w-[320px] flex-shrink-0 group">
              <Card className="relative overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
                <div className="absolute top-2 left-2 z-10"><Badge className="bg-primary text-primary-foreground text-[10px] font-black px-1.5 py-0.5">#{i + 1}</Badge></div>
                <div className="absolute top-2 right-2 z-10"><Badge className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 animate-pulse">LIVE DEMO</Badge></div>
                <button onClick={() => toggleWish(p.id)} className="absolute top-10 right-2 z-10"><Heart className={cn('h-4 w-4 transition-colors', wishlist.includes(p.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400')} /></button>
                <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center"><div className="w-16 h-16 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-3xl">🏨</div></div>
                <CardContent className="p-4 space-y-3">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest text-primary border-primary/30">Hospitality</Badge>
                  <h3 className="font-bold text-sm leading-tight line-clamp-2 uppercase tracking-tight">{p.name}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>
                  <div className="flex flex-wrap gap-1">{p.features.slice(0, 4).map(f => <Badge key={f} variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">{f}</Badge>)}{p.features.length > 4 && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">+{p.features.length - 4}</Badge>}</div>
                  <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground line-through">${p.old_price}</span><span className="text-lg font-black text-primary">${p.price}</span><Badge className="bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0">50% OFF</Badge></div>
                  <div className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /><span className="text-xs font-semibold">{p.rating}</span></div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => openLocalDemo(p)}><Play className="h-3 w-3" /> DEMO</Button>
                    <Button size="sm" className="flex-1 text-xs gap-1" onClick={() => licenseState.valid ? toast.success('Already unlocked!') : setShowKey(true)}>{licenseState.valid ? <><CheckCircle2 className="h-3 w-3" /> UNLOCKED</> : <><KeyRound className="h-3 w-3" /> BUY ${p.price}</>}</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </SectionSlider>
      </main>

      <Dialog open={showKey} onOpenChange={setShowKey}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> License Key Activation</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Enter your license key to unlock all 5 Hospitality software demos offline for {LICENSE_DAYS} days.</p>
            <Input placeholder="HOTEL-APK-2026-001" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && activate()} className="font-mono text-center tracking-widest" />
            <Button onClick={activate} className="w-full gap-2"><ShieldCheck className="h-4 w-4" /> Activate License</Button>
            <p className="text-[10px] text-center text-muted-foreground">Keys are validated offline. No internet required. Valid for {LICENSE_DAYS} days.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!demoProduct} onOpenChange={() => setDemoProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-primary" /> {demoProduct?.name} — Local Demo</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {licenseState.valid ? (
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-6 text-center space-y-3">
                  <div className="text-4xl">🏨</div>
                  <p className="font-semibold text-sm">{demoProduct?.name}</p>
                  <p className="text-xs text-muted-foreground">Local demo loaded from device storage</p>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Offline Ready</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">{demoProduct?.features.map(f => <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3 w-3 text-green-500" />{f}</div>)}</div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-xs gap-1" onClick={() => window.open(demoProduct?.repo, '_blank')}><ExternalLink className="h-3 w-3" /> GitHub Repo</Button>
                  <Button className="flex-1 text-xs gap-1" onClick={() => { toast.success(`Opening local demo: /demo/${demoProduct?.demoFolder}/demo.html`); }}><Play className="h-3 w-3" /> Open Demo</Button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-3 py-4">
                <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Activate license to access local demos</p>
                <Button size="sm" onClick={() => { setDemoProduct(null); setShowKey(true); }} className="gap-1"><KeyRound className="h-3 w-3" /> Enter Key</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
