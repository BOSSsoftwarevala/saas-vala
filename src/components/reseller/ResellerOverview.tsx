import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
 import { useNavigate } from 'react-router-dom';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { useAuth } from '@/hooks/useAuth';
 import { useWallet } from '@/hooks/useWallet';
import { dashboardApi } from '@/lib/dashboardApi';
import { useResellerPlanBadge } from '@/hooks/useResellerPlanBadge';
 import {
   Key,
   Users,
   DollarSign,
   Wallet,
   Share2,
   Lock,
   ArrowRight,
   AlertCircle,
 } from 'lucide-react';
 
 const MINIMUM_BALANCE = 50;
 
 const quickModules = [
   { title: 'Generate Keys', description: 'Create license keys for clients', icon: Key, tab: 'keys', color: 'from-primary to-orange-500' },
   { title: 'My Clients', description: 'Track client purchases', icon: Users, tab: 'clients', color: 'from-secondary to-cyan-500' },
   { title: 'Add Balance', description: 'Top up your wallet', icon: Wallet, tab: 'wallet', color: 'from-green-500 to-emerald-500' },
   { title: 'Refer & Earn', description: 'Earn commission on referrals', icon: Share2, tab: 'referral', color: 'from-purple-500 to-pink-500' },
   { title: 'Change Password', description: 'Update your security', icon: Lock, tab: 'password', color: 'from-amber-500 to-orange-500' },
 ];
 
 export function ResellerOverview() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { wallet } = useWallet();
  const { plan } = useResellerPlanBadge();
  const [metrics, setMetrics] = useState({
    keysGenerated: 0,
    activeClients: 0,
    referralEarnings: 0,
  });
 
   const balance = wallet?.balance || 0;
   const canGenerate = balance >= MINIMUM_BALANCE;

  useEffect(() => {
    const loadMetrics = async () => {
      if (!user?.id) return;
      try {
        const data = await (dashboardApi as any).getResellerData(user.id);
        setMetrics({
          keysGenerated: Number(data?.reseller?.keys_generated || data?.keys?.length || 0),
          activeClients: Number(data?.reseller?.active_clients || 0),
          referralEarnings: Number(data?.reseller?.total_earned || wallet?.total_earned || 0),
        });
      } catch (error) {
        console.error('Failed to load reseller overview metrics', error);
      }
    };

    loadMetrics();
    const interval = window.setInterval(loadMetrics, 15000);
    return () => window.clearInterval(interval);
  }, [user?.id, wallet?.total_earned]);
 
   return (
     <div className="space-y-6">
       {/* Welcome Section */}
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
       >
         <div className="flex items-center gap-2 flex-wrap">
           <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
             Welcome back, {user?.user_metadata?.full_name || 'Partner'}!
           </h1>
           <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
             {plan.badgeIcon} {plan.badgeLabel}
           </Badge>
         </div>
         <p className="text-muted-foreground mt-1">Here's your reseller dashboard overview.</p>
       </motion.div>
 
       {/* Balance Warning */}
       {!canGenerate && (
         <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
         >
           <Card className="border-amber-500/50 bg-amber-500/10">
             <CardContent className="p-4 flex items-center gap-4">
               <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                 <AlertCircle className="h-6 w-6 text-amber-500" />
               </div>
               <div className="flex-1">
                 <h3 className="font-semibold text-foreground">Low Balance Alert</h3>
                 <p className="text-sm text-muted-foreground">
                   Add at least <strong>${MINIMUM_BALANCE}</strong> to start generating license keys.
                   Current balance: <strong>${balance.toFixed(2)}</strong>
                 </p>
               </div>
               <Button onClick={() => navigate('/reseller/dashboard?tab=wallet')}>
                 <Wallet className="h-4 w-4 mr-2" />
                 Add Balance
               </Button>
             </CardContent>
           </Card>
         </motion.div>
       )}
 
       {/* Stats Cards */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1 }}
         >
           <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
             <CardContent className="p-5">
               <div className="flex items-start justify-between">
                 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
                   <Wallet className="h-6 w-6 text-white" />
                 </div>
                 <Badge variant="outline" className={canGenerate ? 'text-green-500 border-green-500/30' : 'text-amber-500 border-amber-500/30'}>
                   {canGenerate ? 'Active' : 'Low'}
                 </Badge>
               </div>
               <div className="mt-4">
                 <p className="text-2xl font-bold text-foreground">${balance.toFixed(2)}</p>
                 <p className="text-sm text-muted-foreground">Wallet Balance</p>
               </div>
             </CardContent>
           </Card>
         </motion.div>
 
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
         >
           <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
             <CardContent className="p-5">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-cyan-500 flex items-center justify-center">
                 <Key className="h-6 w-6 text-white" />
               </div>
               <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{metrics.keysGenerated}</p>
                 <p className="text-sm text-muted-foreground">Keys Generated</p>
               </div>
             </CardContent>
           </Card>
         </motion.div>
 
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
         >
           <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
             <CardContent className="p-5">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                 <Users className="h-6 w-6 text-white" />
               </div>
               <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{metrics.activeClients}</p>
                 <p className="text-sm text-muted-foreground">Active Clients</p>
               </div>
             </CardContent>
           </Card>
         </motion.div>
 
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
         >
           <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
             <CardContent className="p-5">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                 <DollarSign className="h-6 w-6 text-white" />
               </div>
               <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">${metrics.referralEarnings.toFixed(2)}</p>
                 <p className="text-sm text-muted-foreground">Referral Earnings</p>
               </div>
             </CardContent>
           </Card>
         </motion.div>
       </div>
 
       {/* Quick Access Modules */}
       <div>
         <h2 className="text-lg font-semibold text-foreground mb-4">Quick Access</h2>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {quickModules.map((module, index) => (
             <motion.div
               key={module.title}
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.5 + index * 0.05 }}
               whileHover={{ scale: 1.02 }}
             >
               <Card
                 className="glass-card border-border/50 hover:border-primary/30 cursor-pointer transition-all h-full"
                 onClick={() => navigate(`/reseller/dashboard?tab=${module.tab}`)}
               >
                 <CardContent className="p-6">
                   <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-4`}>
                     <module.icon className="h-6 w-6 text-white" />
                   </div>
                   <div className="flex items-center justify-between">
                     <div>
                       <h3 className="font-semibold text-foreground mb-1">{module.title}</h3>
                       <p className="text-sm text-muted-foreground">{module.description}</p>
                     </div>
                     <ArrowRight className="h-5 w-5 text-muted-foreground" />
                   </div>
                 </CardContent>
               </Card>
             </motion.div>
           ))}
         </div>
       </div>
     </div>
   );
 }