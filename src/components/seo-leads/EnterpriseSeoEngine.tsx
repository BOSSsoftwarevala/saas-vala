 import { useState, useCallback } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Switch } from '@/components/ui/switch';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import {
   Globe,
   Sparkles,
   Zap,
   TrendingUp,
   Search,
   FileText,
   DollarSign,
   Shield,
   Loader2,
   CheckCircle2,
   Copy,
   Settings,
 } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { motion, AnimatePresence } from 'framer-motion';
 import {
   INDIA_CITIES,
   AFRICA_CITIES,
   BUSINESS_CATEGORIES,
   TRUST_SIGNALS,
   generateSchema,
   calculateSeoScore,
   analyzeKeyword,
 } from '@/lib/seoEngine';
 
 interface SeoResult {
   title?: string;
   description?: string;
   keywords?: string[];
   ogTitle?: string;
   ogDescription?: string;
   h1?: string;
   h2Tags?: string[];
   schema?: object;
   content?: {
     heading?: string;
     subheading?: string;
     introduction?: string;
     features?: string[];
     benefits?: string[];
     cta?: string;
   };
 }
 
 export function EnterpriseSeoEngine() {
   const [market, setMarket] = useState<'india' | 'africa'>('india');
   const [language, setLanguage] = useState<'english' | 'hinglish' | 'simple-english'>('english');
   const [businessType, setBusinessType] = useState('SaaS');
   const [pageName, setPageName] = useState('');
   const [content, setContent] = useState('');
 const [targetCity, setTargetCity] = useState('auto');
   const [isProcessing, setIsProcessing] = useState(false);
   const [result, setResult] = useState<SeoResult | null>(null);
   const [seoScore, setSeoScore] = useState<number>(0);
   const [autoMode, setAutoMode] = useState(true);
 
   const cities = market === 'india' ? INDIA_CITIES : AFRICA_CITIES;
 
   const runSeoOptimization = useCallback(async (action: string) => {
     setIsProcessing(true);
     try {
       const { data, error } = await supabase.functions.invoke('seo-optimize', {
         body: {
           action,
           content,
           pageName,
           businessType,
           market,
           targetCities: targetCity && targetCity !== 'auto' ? [targetCity] : cities.slice(0, 3),
           language,
         }
       });
 
       if (error) {
         toast.error('SEO optimization failed: ' + error.message);
         return;
       }
 
       if (data?.data) {
         setResult(data.data);
         
         // Calculate score
         const scoreResult = calculateSeoScore({
           title: data.data.title,
           description: data.data.description,
           keywords: data.data.keywords,
           ogTitle: data.data.ogTitle,
           ogDescription: data.data.ogDescription,
           schema: data.data.schema || generateSchema('SoftwareApplication', {
             name: pageName || 'Software',
             description: data.data.description || '',
           }),
         });
         setSeoScore(scoreResult.score);
         
         toast.success(`SEO ${action} completed!`, {
           description: `Score: ${scoreResult.score}/100`,
         });
       }
     } catch (err: any) {
       toast.error('Error: ' + err.message);
     } finally {
       setIsProcessing(false);
     }
   }, [content, pageName, businessType, market, targetCity, cities, language]);
 
   const copyToClipboard = (text: string, label: string) => {
     navigator.clipboard.writeText(text);
     toast.success(`${label} copied!`);
   };
 
   const getScoreColor = (score: number) => {
     if (score >= 80) return 'text-green-500';
     if (score >= 60) return 'text-amber-500';
     return 'text-red-500';
   };
 
   const getScoreBg = (score: number) => {
     if (score >= 80) return 'bg-green-500';
     if (score >= 60) return 'bg-amber-500';
     return 'bg-red-500';
   };
 
   return (
     <div className="space-y-6">
       {/* Header Stats */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Target Market</p>
                 <p className="text-xl font-bold capitalize">{market}</p>
               </div>
               <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                 <Globe className="h-6 w-6 text-primary" />
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">SEO Score</p>
                 <p className={`text-xl font-bold ${getScoreColor(seoScore)}`}>{seoScore}/100</p>
               </div>
               <div className={`h-12 w-12 rounded-xl ${getScoreBg(seoScore)}/20 flex items-center justify-center`}>
                 <TrendingUp className={`h-6 w-6 ${getScoreColor(seoScore)}`} />
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Cost Strategy</p>
                 <p className="text-xl font-bold text-green-500">LOW</p>
               </div>
               <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                 <DollarSign className="h-6 w-6 text-green-500" />
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Auto Mode</p>
                 <div className="flex items-center gap-2">
                   <Switch checked={autoMode} onCheckedChange={setAutoMode} />
                   <span className="text-sm">{autoMode ? 'ON' : 'OFF'}</span>
                 </div>
               </div>
               <div className="h-12 w-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                 <Zap className="h-6 w-6 text-secondary" />
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Configuration */}
       <Card className="glass-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Settings className="h-5 w-5 text-primary" />
             SEO Configuration
           </CardTitle>
           <CardDescription>
             Enterprise AI SEO Engine - India + Africa Focus
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">Primary Market</label>
               <Select value={market} onValueChange={(v) => setMarket(v as 'india' | 'africa')}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="india">🇮🇳 India</SelectItem>
                   <SelectItem value="africa">🌍 Africa</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             
             <div className="space-y-2">
               <label className="text-sm font-medium">Language</label>
               <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="english">English</SelectItem>
                   <SelectItem value="hinglish">Hinglish</SelectItem>
                   <SelectItem value="simple-english">Simple English</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             
             <div className="space-y-2">
               <label className="text-sm font-medium">Business Type</label>
               <Select value={businessType} onValueChange={setBusinessType}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {BUSINESS_CATEGORIES.map(cat => (
                     <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             
             <div className="space-y-2">
               <label className="text-sm font-medium">Target City</label>
               <Select value={targetCity} onValueChange={setTargetCity}>
                 <SelectTrigger>
                   <SelectValue placeholder="Auto-detect" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="auto">Auto-detect</SelectItem>
                   {cities.map(city => (
                     <SelectItem key={city} value={city}>{city}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">Page Name</label>
               <Input
                 value={pageName}
                 onChange={(e) => setPageName(e.target.value)}
                 placeholder="e.g., Billing Software, CRM Dashboard"
               />
             </div>
             
             <div className="space-y-2">
               <label className="text-sm font-medium">Content (for AI analysis)</label>
               <Textarea
                 value={content}
                 onChange={(e) => setContent(e.target.value)}
                 placeholder="Paste your page content here for AI-powered optimization..."
                 rows={3}
               />
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Action Buttons */}
       <div className="flex flex-wrap gap-3">
         <Button
           onClick={() => runSeoOptimization('generate-meta')}
           disabled={isProcessing}
           className="gap-2"
         >
           {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
           Generate Meta Tags
         </Button>
         
         <Button
           onClick={() => runSeoOptimization('analyze-keywords')}
           disabled={isProcessing}
           variant="outline"
           className="gap-2"
         >
           <Search className="h-4 w-4" />
           Analyze Keywords
         </Button>
         
         <Button
           onClick={() => runSeoOptimization('generate-content')}
           disabled={isProcessing}
           variant="outline"
           className="gap-2"
         >
           <Sparkles className="h-4 w-4" />
           Generate Content
         </Button>
         
         <Button
           onClick={() => runSeoOptimization('full-optimize')}
           disabled={isProcessing}
           variant="secondary"
           className="gap-2"
         >
           <Zap className="h-4 w-4" />
           Full Optimization
         </Button>
       </div>
 
       {/* Results */}
       <AnimatePresence>
         {result && (
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
           >
             <Card className="glass-card">
               <CardHeader>
                 <CardTitle className="flex items-center justify-between">
                   <span className="flex items-center gap-2">
                     <CheckCircle2 className="h-5 w-5 text-green-500" />
                     SEO Results
                   </span>
                   <Badge className={`${getScoreBg(seoScore)}/20 ${getScoreColor(seoScore)}`}>
                     Score: {seoScore}/100
                   </Badge>
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <Tabs defaultValue="meta" className="w-full">
                   <TabsList className="grid w-full grid-cols-4">
                     <TabsTrigger value="meta">Meta Tags</TabsTrigger>
                     <TabsTrigger value="keywords">Keywords</TabsTrigger>
                     <TabsTrigger value="schema">Schema</TabsTrigger>
                     <TabsTrigger value="content">Content</TabsTrigger>
                   </TabsList>
                   
                   <TabsContent value="meta" className="space-y-4 mt-4">
                     {result.title && (
                       <div className="space-y-2">
                         <div className="flex items-center justify-between">
                           <label className="text-sm font-medium">Meta Title</label>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => copyToClipboard(result.title!, 'Title')}
                           >
                             <Copy className="h-3 w-3" />
                           </Button>
                         </div>
                         <div className="p-3 bg-muted/50 rounded-lg">
                           <p className="text-sm">{result.title}</p>
                           <p className="text-xs text-muted-foreground mt-1">
                             {result.title.length}/60 characters
                           </p>
                         </div>
                       </div>
                     )}
                     
                     {result.description && (
                       <div className="space-y-2">
                         <div className="flex items-center justify-between">
                           <label className="text-sm font-medium">Meta Description</label>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => copyToClipboard(result.description!, 'Description')}
                           >
                             <Copy className="h-3 w-3" />
                           </Button>
                         </div>
                         <div className="p-3 bg-muted/50 rounded-lg">
                           <p className="text-sm">{result.description}</p>
                           <p className="text-xs text-muted-foreground mt-1">
                             {result.description.length}/160 characters
                           </p>
                         </div>
                       </div>
                     )}
                     
                     {result.ogTitle && (
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <label className="text-sm font-medium">OG Title</label>
                           <div className="p-3 bg-muted/50 rounded-lg text-sm">
                             {result.ogTitle}
                           </div>
                         </div>
                         <div className="space-y-2">
                           <label className="text-sm font-medium">OG Description</label>
                           <div className="p-3 bg-muted/50 rounded-lg text-sm">
                             {result.ogDescription}
                           </div>
                         </div>
                       </div>
                     )}
                   </TabsContent>
                   
                   <TabsContent value="keywords" className="mt-4">
                     <div className="space-y-4">
                       <div className="flex flex-wrap gap-2">
                         {result.keywords?.map((kw, idx) => {
                           const analysis = analyzeKeyword(kw, market);
                           return (
                             <Badge
                               key={idx}
                               variant="outline"
                               className={`cursor-pointer ${
                                 analysis.competition === 'low'
                                   ? 'bg-green-500/10 border-green-500/30 text-green-500'
                                   : analysis.competition === 'medium'
                                     ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                     : 'bg-red-500/10 border-red-500/30 text-red-500'
                               }`}
                             >
                               {kw}
                               {analysis.recommended && <CheckCircle2 className="h-3 w-3 ml-1" />}
                             </Badge>
                           );
                         })}
                       </div>
                       
                       <div className="grid grid-cols-3 gap-4 text-sm">
                         <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full bg-green-500" />
                           <span>Low Competition</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full bg-amber-500" />
                           <span>Medium Competition</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full bg-red-500" />
                           <span>High Competition</span>
                         </div>
                       </div>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="schema" className="mt-4">
                     <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <label className="text-sm font-medium">JSON-LD Schema</label>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => copyToClipboard(
                             JSON.stringify(result.schema || generateSchema('SoftwareApplication', {
                               name: pageName || businessType,
                               description: result.description || '',
                             }), null, 2),
                             'Schema'
                           )}
                         >
                           <Copy className="h-3 w-3 mr-1" /> Copy
                         </Button>
                       </div>
                       <ScrollArea className="h-64">
                         <pre className="p-4 bg-muted/50 rounded-lg text-xs overflow-x-auto">
                           {JSON.stringify(
                             result.schema || generateSchema('SoftwareApplication', {
                               name: pageName || businessType,
                               description: result.description || '',
                               rating: 4.5,
                               reviewCount: 150,
                             }),
                             null,
                             2
                           )}
                         </pre>
                       </ScrollArea>
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="content" className="mt-4">
                     {result.content ? (
                       <div className="space-y-4">
                         {result.content.heading && (
                           <div>
                             <label className="text-sm font-medium">H1 Heading</label>
                             <p className="text-lg font-bold mt-1">{result.content.heading}</p>
                           </div>
                         )}
                         {result.content.subheading && (
                           <div>
                             <label className="text-sm font-medium">Subheading</label>
                             <p className="text-muted-foreground mt-1">{result.content.subheading}</p>
                           </div>
                         )}
                         {result.content.introduction && (
                           <div>
                             <label className="text-sm font-medium">Introduction</label>
                             <p className="mt-1">{result.content.introduction}</p>
                           </div>
                         )}
                         {result.content.features && (
                           <div>
                             <label className="text-sm font-medium">Features</label>
                             <ul className="list-disc list-inside mt-1 space-y-1">
                               {result.content.features.map((f, i) => (
                                 <li key={i} className="text-sm">{f}</li>
                               ))}
                             </ul>
                           </div>
                         )}
                         {result.content.cta && (
                           <div className="p-4 bg-primary/10 rounded-lg">
                             <label className="text-sm font-medium">Call to Action</label>
                             <p className="text-primary font-bold mt-1">{result.content.cta}</p>
                           </div>
                         )}
                       </div>
                     ) : (
                       <div className="text-center py-8 text-muted-foreground">
                         Click "Generate Content" to create SEO-optimized content
                       </div>
                     )}
                   </TabsContent>
                 </Tabs>
               </CardContent>
             </Card>
           </motion.div>
         )}
       </AnimatePresence>
 
       {/* Trust Signals */}
       <Card className="glass-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Shield className="h-5 w-5 text-primary" />
             Enterprise Trust Signals
           </CardTitle>
           <CardDescription>
             Auto-injected into all SEO content
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="flex flex-wrap gap-2">
             {TRUST_SIGNALS.map((signal, idx) => (
               <Badge key={idx} variant="outline" className="bg-primary/5">
                 <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                 {signal}
               </Badge>
             ))}
           </div>
         </CardContent>
       </Card>
     </div>
   );
 }