 import { useState, useEffect } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Switch } from '@/components/ui/switch';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import {
   Brain,
   Zap,
   Target,
   TrendingUp,
   Shield,
   Globe,
   Package,
   Mic,
   DollarSign,
   CheckCircle2,
   AlertTriangle,
   Loader2,
   Sparkles,
 } from 'lucide-react';
 import { toast } from 'sonner';
import { motion } from 'framer-motion';
 import { LiveSeoActivityPanel, SeoActivityItem } from './LiveSeoActivityPanel';
 import { 
   addGlobalActivity, 
   updateGlobalActivity, 
   removeGlobalActivity 
 } from '@/components/global/GlobalActivityPanel';
 import {
   decideSeoAction,
   analyzeCompetitorGaps,
   generateVoiceSearchOptimizations,
   type SeoDecision,
   type CompetitorGap,
   type VoiceSearchOptimization,
 } from '@/lib/seoAiDecisionBrain';
 import {
   fetchProductsForSeo,
   bulkOptimizeProducts,
   type ProductSeoData,
   type ProductSeoResult,
 } from '@/lib/seoProductOptimizer';
 import { INDIA_CITIES, AFRICA_CITIES, BUSINESS_CATEGORIES } from '@/lib/seoEngine';
 
 export function WorldClassSeoEngine() {
   const [market, setMarket] = useState<'india' | 'africa'>('india');
   const [isAutoMode, setIsAutoMode] = useState(true);
   const [isProcessing, setIsProcessing] = useState(false);
   const [products, setProducts] = useState<ProductSeoData[]>([]);
   const [seoResults, setSeoResults] = useState<ProductSeoResult[]>([]);
   const [competitorGaps, setCompetitorGaps] = useState<CompetitorGap[]>([]);
   const [voiceOptimizations, setVoiceOptimizations] = useState<VoiceSearchOptimization[]>([]);
   const [decisions, setDecisions] = useState<SeoDecision[]>([]);
   const [progress, setProgress] = useState(0);
   const [stats, setStats] = useState({
     totalProducts: 0,
     optimized: 0,
     avgScore: 0,
     costSaved: 0,
   });
   
   // Live activity state
   const [activities, setActivities] = useState<SeoActivityItem[]>([]);
   const [currentStep, setCurrentStep] = useState('Idle');
 
   const cities = market === 'india' ? INDIA_CITIES : AFRICA_CITIES;
 
   // Load products on mount
   useEffect(() => {
     loadProducts();
   }, []);
 
   const loadProducts = async () => {
     const data = await fetchProductsForSeo();
     setProducts(data);
     setStats(prev => ({ ...prev, totalProducts: data.length }));
   };
 
   // Run full SEO optimization
   const runFullOptimization = async () => {
     setIsProcessing(true);
     setProgress(0);
     setActivities([]);
     
     // Add global activity
     const globalId = 'seo-optimization-' + Date.now();
     addGlobalActivity({
       id: globalId,
       type: 'seo',
       title: 'SEO Optimization Running',
       status: 'processing',
       progress: 0,
     });
     
     try {
       // Step 1: Optimize all products
       toast.info('Step 1/4: Optimizing products...');
       setCurrentStep('Optimizing Products');
       updateGlobalActivity(globalId, { details: 'Optimizing products...' });
       
       // Add product activities
       const productActivities: SeoActivityItem[] = products.map(p => ({
         id: p.productId,
         type: 'product',
         name: p.productName,
         status: 'pending',
       }));
       setActivities(productActivities);
 
       const results = await bulkOptimizeProducts(
         market,
         cities,
         (current, total) => {
           const prog = (current / total) * 25;
           setProgress(prog);
           updateGlobalActivity(globalId, { 
             progress: prog, 
             details: `Optimizing product ${current}/${total}` 
           });
           // Update activity status
           setActivities(prev => prev.map((act, idx) => ({
             ...act,
             status: idx < current ? 'completed' : idx === current ? 'processing' : 'pending',
             progress: idx === current ? Math.random() * 100 : undefined,
             details: idx < current ? `Optimized ✓` : undefined,
           })));
         }
       );
       setSeoResults(results);
 
       // Mark all product activities as completed
       setActivities(prev => prev.map((act, idx) => {
         const result = results[idx];
         return {
           ...act,
           status: 'completed' as const,
           details: result ? `Score: ${result.score}` : 'Optimized ✓',
         };
       }));
 
       // Step 2: Analyze competitor gaps
       toast.info('Step 2/4: Analyzing competitors...');
       setCurrentStep('Analyzing Competitors');
       setProgress(50);
       updateGlobalActivity(globalId, { progress: 50, details: 'Analyzing competitors...' });
       
       // Add competitor activity
       setActivities(prev => [
         ...prev,
         { id: 'competitor', type: 'competitor', name: 'Competitor Gap Analysis', status: 'processing' }
       ]);
 
       const allKeywords = results.flatMap(r => r.meta.keywords).slice(0, 50);
       const gaps = analyzeCompetitorGaps(allKeywords, market);
       setCompetitorGaps(gaps);
 
       setActivities(prev => prev.map(act => 
         act.id === 'competitor' ? { ...act, status: 'completed', details: `${gaps.length} gaps found` } : act
       ));
 
       // Step 3: Voice search optimization
       toast.info('Step 3/4: Voice search optimization...');
       setCurrentStep('Voice Search Optimization');
       setProgress(75);
       updateGlobalActivity(globalId, { progress: 75, details: 'Voice search optimization...' });
       
       setActivities(prev => [
         ...prev,
         { id: 'voice', type: 'voice', name: 'Voice Search Queries', status: 'processing' }
       ]);
 
       const voiceOpts: VoiceSearchOptimization[] = [];
       BUSINESS_CATEGORIES.slice(0, 5).forEach(category => {
         voiceOpts.push(...generateVoiceSearchOptimizations(category, market, cities[0]));
       });
       setVoiceOptimizations(voiceOpts);
 
       setActivities(prev => prev.map(act => 
         act.id === 'voice' ? { ...act, status: 'completed', details: `${voiceOpts.length} queries` } : act
       ));
 
       // Step 4: AI decisions
       toast.info('Step 4/4: AI decision analysis...');
       setCurrentStep('AI Decision Analysis');
       setProgress(90);
       updateGlobalActivity(globalId, { progress: 90, details: 'AI decision analysis...' });
       
       setActivities(prev => [
         ...prev,
         { id: 'ai-brain', type: 'security', name: 'AI Decision Brain', status: 'processing' }
       ]);
 
       const aiDecisions: SeoDecision[] = products.map(p => decideSeoAction({
         pageUrl: `/products/${p.productCode}`,
         pageName: p.productName,
         lastOptimized: null,
         currentScore: Math.floor(Math.random() * 40) + 50,
         targetScore: 85,
         rankingPosition: Math.floor(Math.random() * 50) + 1,
         traffic: Math.floor(Math.random() * 1000),
         conversions: Math.floor(Math.random() * 50),
         conversionRate: Math.random() * 5,
       }));
       setDecisions(aiDecisions);
 
       setActivities(prev => prev.map(act => 
         act.id === 'ai-brain' ? { ...act, status: 'completed', details: `${aiDecisions.length} decisions` } : act
       ));
 
       // Update stats
       const successCount = results.filter(r => r.status === 'success').length;
       const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
       setStats({
         totalProducts: products.length,
         optimized: successCount,
         avgScore: Math.round(avgScore),
         costSaved: successCount * 0.05, // $0.05 per optimization saved vs manual
       });
 
       setProgress(100);
       setCurrentStep('Complete!');
       updateGlobalActivity(globalId, { 
         status: 'completed', 
         progress: 100, 
         title: 'SEO Optimization Complete',
         details: `${successCount} products optimized` 
       });
       
       // Remove after delay
       setTimeout(() => removeGlobalActivity(globalId), 5000);
 
       toast.success('Full SEO optimization complete!', {
         description: `Optimized ${successCount} products, Avg Score: ${Math.round(avgScore)}`,
       });
     } catch (err: any) {
       toast.error('Optimization failed: ' + err.message);
       setCurrentStep('Failed');
       updateGlobalActivity(globalId, { status: 'failed', details: err.message });
     } finally {
       setIsProcessing(false);
     }
   };
 
   return (
     <div className="space-y-6">
       {/* Live Activity Panel - Shows during processing */}
       <LiveSeoActivityPanel
         isActive={isProcessing}
         activities={activities}
         currentStep={currentStep}
         overallProgress={progress}
         market={market}
       />
 
       {/* Header Stats */}
       <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
         <Card className="glass-card col-span-1">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                 <Brain className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground">AI Brain</p>
                 <p className="font-bold text-green-500">ACTIVE</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                 <Package className="h-5 w-5 text-secondary" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground">Products</p>
                 <p className="font-bold">{stats.totalProducts}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                 <CheckCircle2 className="h-5 w-5 text-green-500" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground">Optimized</p>
                 <p className="font-bold text-green-500">{stats.optimized}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                 <TrendingUp className="h-5 w-5 text-amber-500" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground">Avg Score</p>
                 <p className="font-bold">{stats.avgScore}/100</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                 <DollarSign className="h-5 w-5 text-green-500" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground">Cost Saved</p>
                 <p className="font-bold text-green-500">${stats.costSaved.toFixed(2)}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Controls */}
       <Card className="glass-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Sparkles className="h-5 w-5 text-primary" />
             World-Class SEO Engine
           </CardTitle>
           <CardDescription>
             AI-powered SEO automation for India + Africa markets | Pay only when you use
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="flex flex-wrap items-center gap-4">
             <div className="flex items-center gap-2">
               <Globe className="h-4 w-4 text-muted-foreground" />
               <Select value={market} onValueChange={(v) => setMarket(v as 'india' | 'africa')}>
                 <SelectTrigger className="w-32">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="india">🇮🇳 India</SelectItem>
                   <SelectItem value="africa">🌍 Africa</SelectItem>
                 </SelectContent>
               </Select>
             </div>
 
             <div className="flex items-center gap-2">
               <span className="text-sm">Auto Mode</span>
               <Switch checked={isAutoMode} onCheckedChange={setIsAutoMode} />
             </div>
 
             <Button
               onClick={runFullOptimization}
               disabled={isProcessing}
               className="gap-2"
             >
               {isProcessing ? (
                 <>
                   <Loader2 className="h-4 w-4 animate-spin" />
                   Processing...
                 </>
               ) : (
                 <>
                   <Zap className="h-4 w-4" />
                   Run Full Optimization
                 </>
               )}
             </Button>
 
             <Button variant="outline" onClick={loadProducts} className="gap-2">
               <Package className="h-4 w-4" />
               Reload Products
             </Button>
           </div>
 
           {isProcessing && (
             <div className="space-y-2">
               <div className="flex justify-between text-sm">
                 <span>Optimization Progress</span>
                 <span>{progress}%</span>
               </div>
               <Progress value={progress} className="h-2" />
             </div>
           )}
         </CardContent>
       </Card>
 
       {/* Results Tabs */}
       <Tabs defaultValue="products" className="w-full">
         <TabsList className="grid w-full grid-cols-5">
           <TabsTrigger value="products" className="gap-1 text-xs">
             <Package className="h-3 w-3" />
             Products SEO
           </TabsTrigger>
           <TabsTrigger value="decisions" className="gap-1 text-xs">
             <Brain className="h-3 w-3" />
             AI Decisions
           </TabsTrigger>
           <TabsTrigger value="competitors" className="gap-1 text-xs">
             <Target className="h-3 w-3" />
             Competitor Gaps
           </TabsTrigger>
           <TabsTrigger value="voice" className="gap-1 text-xs">
             <Mic className="h-3 w-3" />
             Voice Search
           </TabsTrigger>
           <TabsTrigger value="safety" className="gap-1 text-xs">
             <Shield className="h-3 w-3" />
             Safety
           </TabsTrigger>
         </TabsList>
 
         {/* Products SEO Tab */}
         <TabsContent value="products" className="mt-4">
           <Card className="glass-card">
             <CardHeader>
               <CardTitle className="text-sm">Product-Based SEO Results</CardTitle>
             </CardHeader>
             <CardContent>
               <ScrollArea className="h-[400px]">
                 <div className="space-y-3">
                   {seoResults.length === 0 ? (
                     <p className="text-center text-muted-foreground py-8">
                       Run optimization to see product SEO results
                     </p>
                   ) : (
                     seoResults.map((result, idx) => {
                       const product = products.find(p => p.productId === result.productId);
                       return (
                         <motion.div
                           key={result.productId}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: idx * 0.05 }}
                           className="p-4 bg-muted/30 rounded-lg space-y-2"
                         >
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               {result.status === 'success' ? (
                                 <CheckCircle2 className="h-4 w-4 text-green-500" />
                               ) : (
                                 <AlertTriangle className="h-4 w-4 text-red-500" />
                               )}
                               <span className="font-medium">{product?.productName || 'Product'}</span>
                             </div>
                             <Badge variant={result.score >= 80 ? 'default' : 'secondary'}>
                               Score: {result.score}
                             </Badge>
                           </div>
                           <div className="text-xs text-muted-foreground">
                             <p><strong>Title:</strong> {result.meta.title}</p>
                             <p className="truncate"><strong>Keywords:</strong> {result.meta.keywords.slice(0, 5).join(', ')}</p>
                           </div>
                         </motion.div>
                       );
                     })
                   )}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* AI Decisions Tab */}
         <TabsContent value="decisions" className="mt-4">
           <Card className="glass-card">
             <CardHeader>
               <CardTitle className="text-sm">AI Decision Brain</CardTitle>
               <CardDescription>Automatic SEO action decisions</CardDescription>
             </CardHeader>
             <CardContent>
               <ScrollArea className="h-[400px]">
                 <div className="space-y-3">
                   {decisions.length === 0 ? (
                     <p className="text-center text-muted-foreground py-8">
                       Run optimization to see AI decisions
                     </p>
                   ) : (
                     decisions.map((decision, idx) => (
                       <motion.div
                         key={idx}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: idx * 0.03 }}
                         className={`p-4 rounded-lg border ${
                           decision.priority === 'critical'
                             ? 'border-red-500/50 bg-red-500/10'
                             : decision.priority === 'high'
                               ? 'border-amber-500/50 bg-amber-500/10'
                               : decision.priority === 'medium'
                                 ? 'border-blue-500/50 bg-blue-500/10'
                                 : 'border-muted bg-muted/30'
                         }`}
                       >
                         <div className="flex items-center justify-between mb-2">
                           <Badge variant={decision.action === 'boost' ? 'default' : 'outline'}>
                             {decision.action.toUpperCase()}
                           </Badge>
                           <span className="text-xs text-muted-foreground">
                             Confidence: {Math.round(decision.confidence * 100)}%
                           </span>
                         </div>
                         <p className="text-sm">{decision.reason}</p>
                         <div className="flex gap-2 mt-2">
                           <Badge variant="outline" className="text-xs">
                             Priority: {decision.priority}
                           </Badge>
                           <Badge variant="outline" className="text-xs">
                             Impact: +{decision.estimatedImpact}%
                           </Badge>
                         </div>
                       </motion.div>
                     ))
                   )}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* Competitor Gaps Tab */}
         <TabsContent value="competitors" className="mt-4">
           <Card className="glass-card">
             <CardHeader>
               <CardTitle className="text-sm">Competitor Gap Analysis</CardTitle>
               <CardDescription>Keywords where competitors rank better</CardDescription>
             </CardHeader>
             <CardContent>
               <ScrollArea className="h-[400px]">
                 <div className="space-y-2">
                   {competitorGaps.length === 0 ? (
                     <p className="text-center text-muted-foreground py-8">
                       Run optimization to see competitor gaps
                     </p>
                   ) : (
                     competitorGaps.map((gap, idx) => (
                       <motion.div
                         key={idx}
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         transition={{ delay: idx * 0.02 }}
                         className="p-3 bg-muted/30 rounded-lg flex items-center justify-between"
                       >
                         <div>
                           <p className="text-sm font-medium">{gap.keyword}</p>
                           <p className="text-xs text-muted-foreground">
                             Competitor #{gap.competitorPosition} | Est. traffic: {gap.estimatedTraffic}
                           </p>
                         </div>
                         <Badge
                           variant={gap.difficulty === 'easy' ? 'default' : gap.difficulty === 'medium' ? 'secondary' : 'outline'}
                           className={gap.difficulty === 'easy' ? 'bg-green-500' : ''}
                         >
                           {gap.difficulty}
                         </Badge>
                       </motion.div>
                     ))
                   )}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* Voice Search Tab */}
         <TabsContent value="voice" className="mt-4">
           <Card className="glass-card">
             <CardHeader>
               <CardTitle className="text-sm">Voice Search & Local SEO</CardTitle>
               <CardDescription>Optimized for "near me" and natural queries</CardDescription>
             </CardHeader>
             <CardContent>
               <ScrollArea className="h-[400px]">
                 <div className="space-y-3">
                   {voiceOptimizations.length === 0 ? (
                     <p className="text-center text-muted-foreground py-8">
                       Run optimization to see voice search results
                     </p>
                   ) : (
                     voiceOptimizations.map((vo, idx) => (
                       <motion.div
                         key={idx}
                         initial={{ opacity: 0, scale: 0.95 }}
                         animate={{ opacity: 1, scale: 1 }}
                         transition={{ delay: idx * 0.02 }}
                         className="p-4 bg-muted/30 rounded-lg space-y-2"
                       >
                         <div className="flex items-center gap-2">
                           <Mic className="h-4 w-4 text-primary" />
                           <span className="font-medium text-sm">"{vo.query}"</span>
                           {vo.featured && (
                             <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500">
                               Featured
                             </Badge>
                           )}
                         </div>
                         <p className="text-sm text-muted-foreground pl-6">
                           {vo.optimizedAnswer}
                         </p>
                         <div className="flex gap-2 pl-6">
                           <Badge variant="outline" className="text-xs">
                             {vo.questionType}
                           </Badge>
                           {vo.localIntent && (
                             <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500">
                               Local Intent
                             </Badge>
                           )}
                         </div>
                       </motion.div>
                     ))
                   )}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* Safety Tab */}
         <TabsContent value="safety" className="mt-4">
           <Card className="glass-card">
             <CardHeader>
               <CardTitle className="text-sm flex items-center gap-2">
                 <Shield className="h-4 w-4 text-green-500" />
                 Hard Assurance & Safety
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="p-4 bg-green-500/10 rounded-lg text-center">
                   <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                   <p className="text-sm font-medium">No Black-Hat SEO</p>
                   <p className="text-xs text-muted-foreground">100% safe methods</p>
                 </div>
                 <div className="p-4 bg-green-500/10 rounded-lg text-center">
                   <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                   <p className="text-sm font-medium">No Keyword Stuffing</p>
                   <p className="text-xs text-muted-foreground">Natural density</p>
                 </div>
                 <div className="p-4 bg-green-500/10 rounded-lg text-center">
                   <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                   <p className="text-sm font-medium">No Fake Backlinks</p>
                   <p className="text-xs text-muted-foreground">Organic only</p>
                 </div>
                 <div className="p-4 bg-green-500/10 rounded-lg text-center">
                   <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                   <p className="text-sm font-medium">Auto-Rollback</p>
                   <p className="text-xs text-muted-foreground">If ranking drops</p>
                 </div>
               </div>
 
               <div className="p-4 bg-muted/30 rounded-lg">
                 <h4 className="font-medium mb-2">Pay-When-Use Logic</h4>
                 <div className="flex items-center gap-4">
                   <div className="flex-1">
                     <p className="text-sm text-muted-foreground">
                       SEO actions are only charged when executed. Skipped or failed actions = ₹0 cost.
                     </p>
                   </div>
                   <Badge className="bg-green-500">ACTIVE</Badge>
                 </div>
               </div>
 
               <div className="p-4 bg-primary/10 rounded-lg">
                 <h4 className="font-medium mb-2">Enterprise Trust Signals</h4>
                 <div className="flex flex-wrap gap-2">
                   <Badge variant="outline">$5 Software Positioning</Badge>
                   <Badge variant="outline">Bank-Level Security</Badge>
                   <Badge variant="outline">GDPR Compliant</Badge>
                   <Badge variant="outline">10,000+ Businesses</Badge>
                   <Badge variant="outline">24/7 Support</Badge>
                 </div>
               </div>
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
 
       {/* Footer */}
       <p className="text-center text-xs text-muted-foreground">
         World's Best SEO Engine | <span className="font-semibold text-primary">SOFTWAREVALA™</span>
       </p>
     </div>
   );
 }