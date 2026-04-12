 import { useState } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Button } from '@/components/ui/button';
 import { 
  Zap, Shield, Server, Wrench, 
  Database, FileCode, Bug, Rocket,
   ChevronRight
 } from 'lucide-react';
 import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
   SheetTrigger,
 } from '@/components/ui/sheet';
 import { cn } from '@/lib/utils';
 
 interface Template {
   id: string;
   icon: typeof Zap;
   title: string;
   description: string;
   prompt: string;
   category: 'deploy' | 'analyze' | 'fix' | 'integrate';
   color: string;
 }
 
 interface QuickTemplatesProps {
   onSelectTemplate: (prompt: string) => void;
 }
 
 const templates: Template[] = [
   {
     id: 'analyze-php',
     icon: FileCode,
     title: 'Analyze PHP Project',
     description: 'Full security & code analysis',
     prompt: 'Please analyze my PHP project for security vulnerabilities, missing dependencies, database schema issues, and provide optimization recommendations.',
     category: 'analyze',
     color: 'from-blue-500 to-cyan-500',
   },
   {
     id: 'deploy-server',
     icon: Server,
     title: 'Deploy to Server',
     description: 'One-click deployment setup',
     prompt: 'Help me deploy my application to a production server. I need assistance with FTP/SSH setup, environment configuration, and database migration.',
     category: 'deploy',
     color: 'from-green-500 to-emerald-500',
   },
   {
     id: 'fix-errors',
     icon: Bug,
     title: 'Fix All Errors',
     description: 'Auto-fix detected issues',
     prompt: 'Scan my uploaded code and automatically fix all detected errors, security vulnerabilities, and deprecated functions. Show me before/after changes.',
     category: 'fix',
     color: 'from-red-500 to-orange-500',
   },
   {
     id: 'security-scan',
     icon: Shield,
     title: 'Security Audit',
     description: 'Comprehensive security check',
     prompt: 'Perform a comprehensive security audit on my code. Check for SQL injection, XSS, CSRF, authentication bypasses, and other OWASP Top 10 vulnerabilities.',
     category: 'analyze',
     color: 'from-purple-500 to-pink-500',
   },
   {
     id: 'add-payment',
     icon: Zap,
     title: 'Add Payment Gateway',
     description: 'Integrate Stripe/Razorpay',
     prompt: 'Help me integrate a payment gateway (Stripe/Razorpay) into my application. Include checkout flow, webhook handling, and subscription management.',
     category: 'integrate',
     color: 'from-yellow-500 to-orange-500',
   },
   {
     id: 'setup-database',
     icon: Database,
     title: 'Setup Database',
     description: 'MySQL/PostgreSQL schema',
     prompt: 'Analyze my application and create the required database schema. Generate migration scripts, indexes, and foreign key relationships.',
     category: 'integrate',
     color: 'from-indigo-500 to-purple-500',
   },
   {
     id: 'optimize-code',
     icon: Rocket,
     title: 'Optimize Performance',
     description: 'Speed & efficiency boost',
     prompt: 'Analyze my code for performance bottlenecks. Optimize database queries, caching strategies, and frontend loading times.',
     category: 'fix',
     color: 'from-cyan-500 to-blue-500',
   },
   {
     id: 'code-upgrade',
     icon: Wrench,
     title: 'Upgrade Legacy Code',
     description: 'Modernize old codebase',
     prompt: 'Upgrade my legacy codebase to modern standards. Update deprecated functions, improve code structure, and add proper error handling.',
     category: 'fix',
     color: 'from-teal-500 to-green-500',
   },
 ];
 
 const categoryLabels = {
   deploy: 'Deployment',
   analyze: 'Analysis',
   fix: 'Fixes',
   integrate: 'Integration',
 };
 
 export function QuickTemplates({ onSelectTemplate }: QuickTemplatesProps) {
   const [isOpen, setIsOpen] = useState(false);
   const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
 
   const filteredTemplates = selectedCategory
     ? templates.filter(t => t.category === selectedCategory)
     : templates;
 
   const handleSelect = (prompt: string) => {
     onSelectTemplate(prompt);
     setIsOpen(false);
   };
 
   return (
     <Sheet open={isOpen} onOpenChange={setIsOpen}>
       <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
            title="Quick Templates"
          >
            <Zap className="h-5 w-5" />
          </Button>
       </SheetTrigger>
       <SheetContent side="right" className="w-[400px] sm:w-[480px] p-0">
         <SheetHeader className="p-6 pb-4 border-b border-border">
           <SheetTitle className="flex items-center gap-2">
             <Zap className="h-5 w-5 text-primary" />
             Quick Templates
           </SheetTitle>
           <SheetDescription>
             Pre-built prompts for common tasks
           </SheetDescription>
         </SheetHeader>
 
         {/* Category Filters */}
         <div className="flex items-center gap-2 p-4 border-b border-border overflow-x-auto">
           <Button
             variant={selectedCategory === null ? 'default' : 'ghost'}
             size="sm"
             onClick={() => setSelectedCategory(null)}
             className="shrink-0"
           >
             All
           </Button>
           {Object.entries(categoryLabels).map(([key, label]) => (
             <Button
               key={key}
               variant={selectedCategory === key ? 'default' : 'ghost'}
               size="sm"
               onClick={() => setSelectedCategory(key)}
               className="shrink-0"
             >
               {label}
             </Button>
           ))}
         </div>
 
         {/* Templates List */}
         <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
           <AnimatePresence mode="popLayout">
             {filteredTemplates.map((template, index) => (
               <motion.button
                 key={template.id}
                 layout
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 transition={{ delay: index * 0.03 }}
                 onClick={() => handleSelect(template.prompt)}
                 className="w-full text-left p-4 rounded-xl bg-card hover:bg-muted/50 border border-border hover:border-primary/30 transition-all duration-200 group"
               >
                 <div className="flex items-start gap-3">
                   <div className={cn(
                     "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0",
                     template.color
                   )}>
                     <template.icon className="h-5 w-5 text-white" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                       <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                         {template.title}
                       </h4>
                       <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                     </div>
                     <p className="text-sm text-muted-foreground line-clamp-2">
                       {template.description}
                     </p>
                   </div>
                 </div>
               </motion.button>
             ))}
           </AnimatePresence>
         </div>
       </SheetContent>
     </Sheet>
   );
 }