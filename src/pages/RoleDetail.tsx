import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Eye, Plus, Edit, Trash2, Download, Settings, History, CheckCircle2, Zap,
  Monitor, Server, Database, Cloud, Brain, Shield, CreditCard, Mail, MessageCircle, Link
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
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { foodHospitalityRole, foodTechStack, foodSubCategories } from '@/data/foodHospitalityData';

const techStack = [
  { name: 'FRONTEND', icon: Monitor, tech: foodTechStack[0].tech },
  { name: 'BACKEND', icon: Server, tech: foodTechStack[1].tech },
  { name: 'DATABASE', icon: Database, tech: foodTechStack[2].tech },
  { name: 'SERVER / CLOUD', icon: Cloud, tech: foodTechStack[3].tech },
  { name: 'AI ENGINE', icon: Brain, tech: foodTechStack[4].tech },
  { name: 'SECURITY LAYER', icon: Shield, tech: foodTechStack[5].tech },
];

export default function RoleDetail() {
  const [enabledCategories, setEnabledCategories] = useState<Record<number, boolean>>(
    Object.fromEntries(foodSubCategories.map(c => [c.id, true]))
  );
  const [permissions, setPermissions] = useState<Record<number, Record<string, boolean>>>(
    Object.fromEntries(foodSubCategories.map(c => [c.id, { view: true, add: true, edit: true, delete: false, export: true }]))
  );
  const [integrations, setIntegrations] = useState<Record<number, Record<string, boolean>>>(
    Object.fromEntries(foodSubCategories.map(c => [c.id, { payment: true, sms: true, whatsapp: false, ai: true, thirdParty: false }]))
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
    <DashboardLayout>
      <div className="space-y-6">
        
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
                  {foodHospitalityRole.name}
                </h2>
                <p className="text-muted-foreground mt-2">
                  {foodHospitalityRole.purpose}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={cn(
                  "font-bold",
                  foodHospitalityRole.status === 'active' 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                )}>
                  {foodHospitalityRole.status.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="font-semibold">
                  {foodHospitalityRole.version}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Updated: {foodHospitalityRole.lastUpdated}
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
                SUB-CATEGORIES ({foodSubCategories.length})
              </h3>
              <Badge variant="outline" className="font-semibold">
                {Object.values(enabledCategories).filter(Boolean).length} ENABLED
              </Badge>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {foodSubCategories.map((category) => (
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
                              {category.coreFeatures.map((feature, idx) => (
                                <li key={idx} className="text-xs text-foreground flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {feature}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-amber-400 uppercase">ADVANCED</span>
                            <ul className="mt-1 space-y-1">
                              {category.advancedFeatures.map((feature, idx) => (
                                <li key={idx} className="text-xs text-foreground flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {feature}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-cyan-400 uppercase">AUTOMATION</span>
                            <ul className="mt-1 space-y-1">
                              {category.automationFeatures.map((feature, idx) => (
                                <li key={idx} className="text-xs text-foreground flex items-center gap-2">
                                  <Zap className="h-3 w-3 text-cyan-400" /> {feature}
                                </li>
                              ))}
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
                            <span className="text-foreground font-medium">{category.tech.frontend}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">BACKEND</span>
                            <span className="text-foreground font-medium">{category.tech.backend}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">DATABASE</span>
                            <span className="text-foreground font-medium">{category.tech.database}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">SERVER</span>
                            <span className="text-foreground font-medium">{category.tech.server}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">AI / ML</span>
                            <span className="text-foreground font-medium">{category.tech.ai}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">SECURITY</span>
                            <span className="text-foreground font-medium">{category.tech.security}</span>
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
                          <Badge className={cn(
                            "text-[10px]",
                            category.supportStatus === 'SUPPORTED' 
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : category.supportStatus === 'ON DEMAND'
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          )}>
                            {category.supportStatus}
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
      </div>
    </DashboardLayout>
  );
}
