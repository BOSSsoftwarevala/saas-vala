import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Eye, Plus, Edit, Trash2, Download, Settings, History,
  Monitor, Server, Database, Cloud, Brain, Shield, CreditCard, Mail, MessageCircle,
  Link, Users, Package, ShoppingCart, Truck,
  GraduationCap, Heart, Landmark, Store, Utensils, Car, Plane, Home, Briefcase,
  Camera, Calendar, MapPin, Lock, Globe, Zap, BarChart3, FileCheck, Wallet,
  Receipt, ClipboardList, Bell, Search, Tag, Star, Clock,
  CheckCircle2, Layers, Grid3X3,
  QrCode, Printer, Phone, Video, Mic, Image, FolderOpen, Archive,
  Send, RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';
import { useNavigate } from 'react-router-dom';
import { Wallet as WalletIcon, User } from 'lucide-react';

const subCategories = [
  { id: 1, name: 'USER MANAGEMENT', icon: Users, description: 'Complete user lifecycle control from registration to deactivation' },
  { id: 2, name: 'PRODUCT CATALOG', icon: Package, description: 'Full product inventory with variants and pricing' },
  { id: 3, name: 'ORDER PROCESSING', icon: ShoppingCart, description: 'End-to-end order management from cart to delivery' },
  { id: 4, name: 'INVENTORY CONTROL', icon: ClipboardList, description: 'Stock management with auto-reorder alerts' },
  { id: 5, name: 'SHIPPING & LOGISTICS', icon: Truck, description: 'Multi-carrier shipping with real-time tracking' },
  { id: 6, name: 'PAYMENT GATEWAY', icon: CreditCard, description: 'Secure payment processing with multiple methods' },
  { id: 7, name: 'INVOICE MANAGEMENT', icon: Receipt, description: 'Automated invoicing with tax calculations' },
  { id: 8, name: 'CUSTOMER SUPPORT', icon: MessageCircle, description: 'Ticket-based support with SLA tracking' },
  { id: 9, name: 'ANALYTICS DASHBOARD', icon: BarChart3, description: 'Real-time business intelligence and reporting' },
  { id: 10, name: 'MARKETING AUTOMATION', icon: Send, description: 'Campaign management with audience segmentation' },
  { id: 11, name: 'EDUCATION MODULE', icon: GraduationCap, description: 'Learning management with course delivery' },
  { id: 12, name: 'HEALTHCARE RECORDS', icon: Heart, description: 'Patient data management with compliance' },
  { id: 13, name: 'GOVERNMENT SERVICES', icon: Landmark, description: 'Public service delivery with citizen portal' },
  { id: 14, name: 'RETAIL OPERATIONS', icon: Store, description: 'POS integration with store management' },
  { id: 15, name: 'FOOD & HOSPITALITY', icon: Utensils, description: 'Restaurant and hotel management system' },
  { id: 16, name: 'TRANSPORT BOOKING', icon: Car, description: 'Vehicle booking with driver assignment' },
  { id: 17, name: 'TRAVEL MANAGEMENT', icon: Plane, description: 'Travel booking with itinerary planning' },
  { id: 18, name: 'REAL ESTATE LISTING', icon: Home, description: 'Property management with virtual tours' },
  { id: 19, name: 'PROFESSIONAL SERVICES', icon: Briefcase, description: 'Service booking with consultant matching' },
  { id: 20, name: 'MEDIA MANAGEMENT', icon: Camera, description: 'Content management with CDN delivery' },
  { id: 21, name: 'EVENT MANAGEMENT', icon: Calendar, description: 'Event planning with registration system' },
  { id: 22, name: 'LOCATION SERVICES', icon: MapPin, description: 'Geo-tracking with route optimization' },
  { id: 23, name: 'ACCESS CONTROL', icon: Lock, description: 'Role-based permissions with audit trail' },
  { id: 24, name: 'MULTI-LANGUAGE', icon: Globe, description: 'Localization with auto-translation' },
  { id: 25, name: 'AUTOMATION ENGINE', icon: Zap, description: 'Workflow automation with triggers' },
  { id: 26, name: 'REPORTING MODULE', icon: FileCheck, description: 'Custom reports with export options' },
  { id: 27, name: 'WALLET SYSTEM', icon: Wallet, description: 'Digital wallet with transaction history' },
  { id: 28, name: 'NOTIFICATION CENTER', icon: Bell, description: 'Multi-channel notifications with preferences' },
  { id: 29, name: 'SEARCH & FILTER', icon: Search, description: 'Advanced search with smart filters' },
  { id: 30, name: 'TAGGING SYSTEM', icon: Tag, description: 'Dynamic tagging with auto-categorization' },
  { id: 31, name: 'RATING & REVIEWS', icon: Star, description: 'Customer feedback with moderation' },
  { id: 32, name: 'SCHEDULING', icon: Clock, description: 'Appointment booking with calendar sync' },
  { id: 33, name: 'APPROVAL WORKFLOW', icon: CheckCircle2, description: 'Multi-level approval with escalation' },
  { id: 34, name: 'DATA IMPORT/EXPORT', icon: RefreshCw, description: 'Bulk data operations with validation' },
  { id: 35, name: 'API MANAGEMENT', icon: Layers, description: 'API gateway with rate limiting' },
  { id: 36, name: 'DASHBOARD BUILDER', icon: Grid3X3, description: 'Custom dashboard with drag-drop widgets' },
  { id: 37, name: 'DOCUMENT MANAGER', icon: FolderOpen, description: 'File storage with version control' },
  { id: 38, name: 'ARCHIVE SYSTEM', icon: Archive, description: 'Data archival with retention policies' },
  { id: 39, name: 'COMMUNICATION HUB', icon: Phone, description: 'Unified communication with VoIP' },
  { id: 40, name: 'VIDEO CONFERENCING', icon: Video, description: 'Virtual meetings with recording' },
  { id: 41, name: 'VOICE ASSISTANT', icon: Mic, description: 'AI voice commands with NLP' },
  { id: 42, name: 'IMAGE PROCESSING', icon: Image, description: 'Image optimization with AI enhancement' },
  { id: 43, name: 'QR CODE SYSTEM', icon: QrCode, description: 'QR generation with scan tracking' },
  { id: 44, name: 'PRINT MANAGEMENT', icon: Printer, description: 'Print queue with template designer' },
  { id: 45, name: 'SYSTEM SETTINGS', icon: Settings, description: 'Global configuration with backup' },
];

const techStack = [
  { name: 'FRONTEND', icon: Monitor, tech: 'React + TypeScript' },
  { name: 'BACKEND', icon: Server, tech: 'Node.js + Express' },
  { name: 'DATABASE', icon: Database, tech: 'PostgreSQL + Redis' },
  { name: 'SERVER / CLOUD', icon: Cloud, tech: 'AWS + Vercel' },
  { name: 'AI ENGINE', icon: Brain, tech: 'GPT-4 + Custom ML' },
  { name: 'SECURITY LAYER', icon: Shield, tech: 'OAuth 2.0 + AES-256' },
];

export default function RoleDetail() {
  const navigate = useNavigate();
  const [enabledCategories, setEnabledCategories] = useState<Record<number, boolean>>(
    Object.fromEntries(subCategories.map(c => [c.id, true]))
  );
  const [permissions, setPermissions] = useState<Record<number, Record<string, boolean>>>(
    Object.fromEntries(subCategories.map(c => [c.id, { view: true, add: true, edit: true, delete: false, export: true }]))
  );
  const [integrations, setIntegrations] = useState<Record<number, Record<string, boolean>>>(
    Object.fromEntries(subCategories.map(c => [c.id, { payment: true, sms: true, whatsapp: false, ai: true, thirdParty: false }]))
  );

  const toggleCategory = (id: number) => {
    setEnabledCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePermission = (categoryId: number, permission: string) => {
    setPermissions(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [permission]: !prev[categoryId][permission] }
    }));
  };

  const toggleIntegration = (categoryId: number, integration: string) => {
    setIntegrations(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [integration]: !prev[categoryId][integration] }
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* GLOBAL HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="h-full px-4 md:px-8 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/marketplace')}
          >
            <img 
              src={saasValaLogo} 
              alt="SaaS VALA" 
              className="h-10 w-10 rounded-xl object-cover border border-primary/20"
            />
            <span className="font-display font-bold text-lg text-foreground hidden sm:block">
              SaaS VALA
            </span>
          </div>

          <h1 className="absolute left-1/2 -translate-x-1/2 font-display font-bold text-foreground text-sm md:text-base uppercase">
            SUPER ADMIN ROLE
          </h1>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 px-2"
              onClick={() => navigate('/wallet')}
            >
              <WalletIcon className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">₹0</span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/settings')}
            >
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="pt-20 pb-16 px-4 md:px-8 max-w-7xl mx-auto">
        
        {/* ROLE HEADER SECTION */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground uppercase tracking-wide">
                  SUPER ADMIN ROLE
                </h2>
                <p className="text-muted-foreground mt-2">
                  Complete system control with all modules and permissions enabled
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold">
                  ACTIVE
                </Badge>
                <Badge variant="outline" className="font-semibold">
                  v3.2.1
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Updated: Feb 04, 2026
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* TECHNOLOGY STRIP */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wide">
              TECHNOLOGY STACK
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {techStack.map((tech) => (
                <div key={tech.name} className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/30">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
                    <tech.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold text-foreground uppercase">{tech.name}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">{tech.tech}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* SUB-CATEGORY MASTER SECTION */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                SUB-CATEGORIES ({subCategories.length})
              </h3>
              <Badge variant="outline" className="font-semibold">
                {Object.values(enabledCategories).filter(Boolean).length} ENABLED
              </Badge>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {subCategories.map((category) => (
                <AccordionItem 
                  key={category.id} 
                  value={`category-${category.id}`}
                  className="border border-border rounded-xl overflow-hidden bg-muted/20"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <category.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground text-sm uppercase">
                            {category.name}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              'text-[9px] px-2',
                              enabledCategories[category.id] 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {enabledCategories[category.id] ? 'ENABLED' : 'DISABLED'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Switch 
                          checked={enabledCategories[category.id]} 
                          onCheckedChange={() => toggleCategory(category.id)}
                        />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                      
                      {/* FEATURE BLOCK */}
                      <div className="bg-background border border-border rounded-xl p-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">FEATURES</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-semibold text-primary uppercase">CORE FEATURES</span>
                            <ul className="mt-1 space-y-1">
                              <li className="text-xs text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Full CRUD Operations
                              </li>
                              <li className="text-xs text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Real-time Updates
                              </li>
                              <li className="text-xs text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Data Validation
                              </li>
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-amber-400 uppercase">ADVANCED</span>
                            <ul className="mt-1 space-y-1">
                              <li className="text-xs text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Bulk Operations
                              </li>
                              <li className="text-xs text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Custom Fields
                              </li>
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-cyan-400 uppercase">AUTOMATION</span>
                            <ul className="mt-1 space-y-1">
                              <li className="text-xs text-foreground flex items-center gap-2">
                                <Zap className="h-3 w-3 text-cyan-400" /> Auto-sync
                              </li>
                              <li className="text-xs text-foreground flex items-center gap-2">
                                <Zap className="h-3 w-3 text-cyan-400" /> Scheduled Tasks
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* TECHNOLOGY BLOCK */}
                      <div className="bg-background border border-border rounded-xl p-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">TECHNOLOGY</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">FRONTEND</span>
                            <span className="text-foreground font-medium">React</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">BACKEND</span>
                            <span className="text-foreground font-medium">Node.js</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">DATABASE</span>
                            <span className="text-foreground font-medium">PostgreSQL</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">SERVER</span>
                            <span className="text-foreground font-medium">AWS Lambda</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">AI / ML</span>
                            <span className="text-foreground font-medium">GPT-4 API</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">SECURITY</span>
                            <span className="text-foreground font-medium">OAuth + JWT</span>
                          </div>
                        </div>
                      </div>

                      {/* PERMISSIONS BLOCK */}
                      <div className="bg-background border border-border rounded-xl p-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">PERMISSIONS</h4>
                        <div className="space-y-2">
                          {[
                            { key: 'view', label: 'VIEW', icon: Eye },
                            { key: 'add', label: 'ADD', icon: Plus },
                            { key: 'edit', label: 'EDIT', icon: Edit },
                            { key: 'delete', label: 'DELETE', icon: Trash2 },
                            { key: 'export', label: 'EXPORT', icon: Download },
                          ].map((perm) => (
                            <label key={perm.key} className="flex items-center gap-3 cursor-pointer">
                              <Checkbox 
                                checked={permissions[category.id]?.[perm.key]} 
                                onCheckedChange={() => togglePermission(category.id, perm.key)}
                              />
                              <perm.icon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-foreground">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* INTEGRATIONS BLOCK */}
                      <div className="bg-background border border-border rounded-xl p-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">INTEGRATIONS</h4>
                        <div className="space-y-2">
                          {[
                            { key: 'payment', label: 'PAYMENT GATEWAY', icon: CreditCard },
                            { key: 'sms', label: 'SMS / EMAIL', icon: Mail },
                            { key: 'whatsapp', label: 'WHATSAPP', icon: MessageCircle },
                            { key: 'ai', label: 'AI API', icon: Brain },
                            { key: 'thirdParty', label: 'THIRD-PARTY TOOLS', icon: Link },
                          ].map((integ) => (
                            <div key={integ.key} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <integ.icon className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-foreground">{integ.label}</span>
                              </div>
                              <Switch 
                                checked={integrations[category.id]?.[integ.key]}
                                onCheckedChange={() => toggleIntegration(category.id, integ.key)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ACTIONS BLOCK */}
                      <div className="bg-background border border-border rounded-xl p-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">ACTIONS</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="text-xs gap-1">
                            <Eye className="h-3 w-3" /> VIEW DETAILS
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs gap-1">
                            <Settings className="h-3 w-3" /> CONFIGURE
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs gap-1">
                            <History className="h-3 w-3" /> AUDIT LOG
                          </Button>
                        </div>
                      </div>

                      {/* SUPPORT STATUS */}
                      <div className="bg-background border border-border rounded-xl p-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">SUPPORT STATUS</h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                            SUPPORTED
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            24/7 AVAILABLE
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            PRIORITY ACCESS
                          </Badge>
                        </div>
                      </div>

                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          POWERED BY <span className="font-bold text-foreground">SOFTWARE VALA™</span>
        </p>
      </footer>
    </div>
  );
}
