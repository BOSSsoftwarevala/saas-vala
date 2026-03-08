import { useState, useEffect } from 'react';
import { SectionSlider } from '@/components/marketplace/SectionSlider';
import { SectionHeader } from '@/components/marketplace/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Star, ExternalLink, Download, KeyRound, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EDUCATION_PRODUCTS = [
  {
    id: 'edu-pwa-1',
    name: 'Google Classroom Clone',
    repo: 'https://github.com/saasvala/googleclassroom-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Virtual classroom platform for assignments, grading, and teacher-student collaboration.',
    features: ['Assignment Manager', 'Classroom Streams', 'Student Submission', 'Gradebook', 'Teacher Dashboard', 'Google Drive Integration'],
  },
  {
    id: 'edu-pwa-2',
    name: 'Moodle LMS Clone',
    repo: 'https://github.com/saasvala/moodle-lms-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Open-source learning management system for course building and student tracking.',
    features: ['Course Builder', 'Quiz System', 'Certificates', 'Student Progress Tracking', 'Teacher Dashboard'],
  },
  {
    id: 'edu-pwa-3',
    name: 'Canvas LMS Clone',
    repo: 'https://github.com/saasvala/canvas-lms-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Modern LMS with course modules, assignments, discussions, and grade analytics.',
    features: ['Course Modules', 'Assignments', 'Discussion Boards', 'Grade Analytics', 'Mobile Learning'],
  },
  {
    id: 'edu-pwa-4',
    name: 'Blackboard Learn Clone',
    repo: 'https://github.com/saasvala/blackboard-learn-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Enterprise virtual classroom with content library and assessment tools.',
    features: ['Virtual Classroom', 'Content Library', 'Exams & Assessments', 'Instructor Tools', 'Student Dashboard'],
  },
  {
    id: 'edu-pwa-5',
    name: 'Schoology LMS Clone',
    repo: 'https://github.com/saasvala/schoology-lms-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Social learning platform with classroom feeds, attendance, and parent portal.',
    features: ['Social Classroom Feed', 'Assignments', 'Attendance', 'Gradebook', 'Parent Portal'],
  },
];

const VALID_KEYS = ['EDU-PWA-2026-001', 'EDU-PWA-2026-002', 'EDU-PWA-2026-003', 'EDU-APK-2026-001'];

function getActivationStatus(): boolean {
  return localStorage.getItem('edu-pwa-activated') === 'true';
}
function setActivationStatus(v: boolean) {
  localStorage.setItem('edu-pwa-activated', v ? 'true' : 'false');
}
function getWishlist(): string[] {
  try { return JSON.parse(localStorage.getItem('edu-pwa-wishlist') || '[]'); } catch { return []; }
}
function setWishlist(ids: string[]) {
  localStorage.setItem('edu-pwa-wishlist', JSON.stringify(ids));
}

export default function EduPwa() {
  const [activated, setActivated] = useState(getActivationStatus);
  const [wishlist, setWishlistState] = useState<string[]>(getWishlist);
  const [showActivation, setShowActivation] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [activatingFor, setActivatingFor] = useState<string | null>(null);

  useEffect(() => {
    // Persist products to localStorage for offline
    localStorage.setItem('edu-pwa-products', JSON.stringify(EDUCATION_PRODUCTS));
  }, []);

  const toggleWishlist = (id: string) => {
    const next = wishlist.includes(id) ? wishlist.filter(x => x !== id) : [...wishlist, id];
    setWishlistState(next);
    setWishlist(next);
    toast.success(next.includes(id) ? 'Added to wishlist' : 'Removed from wishlist');
  };

  const handleBuy = (productId: string) => {
    if (activated) {
      toast.success('Product already activated! Use Master Copy to download.');
      return;
    }
    setActivatingFor(productId);
    setShowActivation(true);
  };

  const handleActivate = () => {
    const trimmed = keyInput.trim().toUpperCase();
    if (VALID_KEYS.includes(trimmed)) {
      setActivated(true);
      setActivationStatus(true);
      setShowActivation(false);
      setKeyInput('');
      toast.success('🎉 License activated! All 5 Education software demos are now unlocked.');
    } else {
      toast.error('Invalid license key. Please check and try again.');
    }
  };

  const handleMasterDownload = () => {
    if (!activated) {
      toast.error('Please activate your license first.');
      setShowActivation(true);
      return;
    }
    // Simulate offline master copy download
    const masterData = {
      bundle: 'SaaS VALA Education Master Copy',
      version: '2026.1',
      activated: true,
      products: EDUCATION_PRODUCTS.map(p => ({ name: p.name, repo: p.repo, features: p.features })),
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(masterData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saas-vala-education-master-copy.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Master Copy downloaded! All 5 Education software demos included.');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">SaaS VALA</h1>
          <p className="text-xs text-muted-foreground">Education & EdTech — Offline PWA</p>
        </div>
        <div className="flex items-center gap-2">
          {activated ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
              <ShieldCheck className="h-3 w-3" /> Licensed
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowActivation(true)} className="gap-1 text-xs">
              <KeyRound className="h-3 w-3" /> Activate License
            </Button>
          )}
        </div>
      </header>

      <main className="py-6 space-y-6">
        {/* Activation Banner */}
        {!activated && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-sm">Activate to unlock all 5 Education Software Demos</p>
                <p className="text-xs text-muted-foreground">Enter license key: EDU-PWA-2026-001</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowActivation(true)} className="gap-1">
              <KeyRound className="h-3 w-3" /> Enter Key
            </Button>
          </div>
        )}

        {/* Master Copy Download */}
        {activated && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-green-500/30 bg-green-500/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-semibold text-sm">Master Copy Ready — All 5 Education Software Unlocked</p>
                <p className="text-xs text-muted-foreground">Download the complete offline bundle</p>
              </div>
            </div>
            <Button size="sm" onClick={handleMasterDownload} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
              <Download className="h-3 w-3" /> Download Master Copy
            </Button>
          </div>
        )}

        {/* Netflix-style Education Row */}
        <SectionHeader
          icon="🎓"
          title="Education & EdTech"
          subtitle="Top 5 Education Software Clones — Offline Ready."
          badge="ROW 05"
          badgeVariant="hot"
          totalCount={5}
        />
        <SectionSlider>
          {EDUCATION_PRODUCTS.map((product, i) => (
            <div
              key={product.id}
              className="min-w-[280px] max-w-[320px] flex-shrink-0 group"
            >
              <Card className="relative overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
                {/* Rank badge */}
                <div className="absolute top-2 left-2 z-10">
                  <Badge className="bg-primary text-primary-foreground text-[10px] font-black px-1.5 py-0.5">
                    #{i + 1}
                  </Badge>
                </div>
                {/* LIVE DEMO badge */}
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 animate-pulse">
                    LIVE DEMO
                  </Badge>
                </div>
                {/* Wishlist */}
                <button
                  onClick={() => toggleWishlist(product.id)}
                  className="absolute top-10 right-2 z-10"
                >
                  <Heart
                    className={cn('h-4 w-4 transition-colors', wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400')}
                  />
                </button>

                {/* Product Icon */}
                <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center">
                  <div className="w-16 h-16 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-3xl">
                    🎓
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Category */}
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest text-primary border-primary/30">
                    Education
                  </Badge>

                  {/* Name */}
                  <h3 className="font-bold text-sm leading-tight line-clamp-2 uppercase tracking-tight">
                    {product.name}
                  </h3>

                  {/* Description */}
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1">
                    {product.features.slice(0, 4).map(f => (
                      <Badge key={f} variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">
                        {f}
                      </Badge>
                    ))}
                    {product.features.length > 4 && (
                      <Badge variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">
                        +{product.features.length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground line-through">${product.old_price}</span>
                    <span className="text-lg font-black text-primary">${product.price}</span>
                    <Badge className="bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0">
                      90% OFF
                    </Badge>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-xs font-semibold">{product.rating}</span>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs gap-1"
                      onClick={() => window.open(product.repo, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" /> DEMO
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs gap-1"
                      onClick={() => handleBuy(product.id)}
                    >
                      {activated ? <CheckCircle2 className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                      {activated ? 'UNLOCKED' : `BUY $${product.price}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </SectionSlider>
      </main>

      {/* Activation Dialog */}
      <Dialog open={showActivation} onOpenChange={setShowActivation}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              License Key Activation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Enter your license key to unlock all 5 Education software demos offline.
            </p>
            <Input
              placeholder="EDU-PWA-2026-001"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              className="font-mono text-center tracking-widest"
            />
            <Button onClick={handleActivate} className="w-full gap-2">
              <ShieldCheck className="h-4 w-4" /> Activate License
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Keys are validated offline. No internet required.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
