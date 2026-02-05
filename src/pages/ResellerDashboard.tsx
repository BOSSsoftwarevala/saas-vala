 import { useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { motion } from 'framer-motion';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import {
   Package,
   Users,
   DollarSign,
   TrendingUp,
   ShoppingCart,
   Key,
   Bell,
   Settings,
   LogOut,
   Wallet,
   BarChart3,
   Plus,
   Eye,
   Download,
   Headphones,
 } from 'lucide-react';
 import saasValaLogo from '@/assets/saas-vala-logo.jpg';
 
 const metrics = [
   { title: 'Total Products', value: '24', icon: Package, change: '+3 this month', color: 'from-primary to-orange-500' },
   { title: 'Active Clients', value: '156', icon: Users, change: '+12 this month', color: 'from-secondary to-cyan-500' },
   { title: 'Total Revenue', value: '₹4,52,000', icon: DollarSign, change: '+18% vs last month', color: 'from-green-500 to-emerald-500' },
   { title: 'Pending Orders', value: '8', icon: TrendingUp, change: '3 urgent', color: 'from-amber-500 to-orange-500' },
 ];
 
 const modules = [
   { title: 'My Products', description: 'View & manage your licensed products', icon: Package, path: '/products', color: 'bg-primary/20 text-primary' },
   { title: 'License Keys', description: 'Manage client license keys', icon: Key, path: '/keys', color: 'bg-secondary/20 text-secondary' },
   { title: 'My Clients', description: 'View client accounts & orders', icon: Users, path: '/clients', color: 'bg-green-500/20 text-green-500' },
   { title: 'Orders', description: 'Track orders & deliveries', icon: ShoppingCart, path: '/orders', color: 'bg-amber-500/20 text-amber-500' },
   { title: 'Earnings', description: 'View commissions & payouts', icon: BarChart3, path: '/earnings', color: 'bg-purple-500/20 text-purple-500' },
   { title: 'Support', description: 'Get help & submit tickets', icon: Headphones, path: '/support', color: 'bg-cyan-500/20 text-cyan-500' },
 ];
 
 const quickActions = [
   { title: 'New Order', icon: Plus, variant: 'default' as const },
   { title: 'View Catalog', icon: Eye, variant: 'outline' as const },
   { title: 'Download Invoice', icon: Download, variant: 'outline' as const },
 ];
 
 export default function ResellerDashboard() {
   const navigate = useNavigate();
   const { user, signOut } = useAuth();
 
   const handleLogout = async () => {
     await signOut();
     navigate('/auth');
   };
 
   return (
     <div className="min-h-screen bg-background">
       {/* Header */}
       <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-md border-b border-border">
         <div className="h-full px-4 md:px-8 flex items-center justify-between">
           {/* Left - Logo */}
           <div className="flex items-center gap-3">
             <img
               src={saasValaLogo}
               alt="SaaS VALA"
               className="h-10 w-10 rounded-xl object-cover border border-primary/20"
             />
             <div>
               <span className="font-display font-bold text-lg text-foreground">SaaS VALA</span>
               <Badge className="ml-2 bg-secondary/20 text-secondary border-0">Reseller</Badge>
             </div>
           </div>
 
           {/* Right - Actions */}
           <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" onClick={() => navigate('/wallet')}>
               <Wallet className="h-5 w-5" />
             </Button>
             <Button variant="ghost" size="icon">
               <Bell className="h-5 w-5" />
             </Button>
             <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
               <Settings className="h-5 w-5" />
             </Button>
             <Button variant="ghost" size="icon" onClick={handleLogout}>
               <LogOut className="h-5 w-5" />
             </Button>
           </div>
         </div>
       </header>
 
       {/* Main Content */}
       <main className="pt-20 pb-8 px-4 md:px-8">
         {/* Welcome */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="mb-8"
         >
           <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
             Welcome back, {user?.user_metadata?.full_name || 'Partner'}!
           </h1>
           <p className="text-muted-foreground mt-1">Here's your reseller dashboard overview.</p>
         </motion.div>
 
         {/* Metrics */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           {metrics.map((metric, index) => (
             <motion.div
               key={metric.title}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: index * 0.1 }}
             >
               <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
                 <CardContent className="p-5">
                   <div className="flex items-start justify-between">
                     <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center`}>
                       <metric.icon className="h-6 w-6 text-white" />
                     </div>
                     <Badge variant="outline" className="text-xs text-muted-foreground">
                       {metric.change}
                     </Badge>
                   </div>
                   <div className="mt-4">
                     <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                     <p className="text-sm text-muted-foreground">{metric.title}</p>
                   </div>
                 </CardContent>
               </Card>
             </motion.div>
           ))}
         </div>
 
         {/* Quick Actions */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="mb-8"
         >
           <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
           <div className="flex flex-wrap gap-3">
             {quickActions.map((action) => (
               <Button key={action.title} variant={action.variant} className="gap-2">
                 <action.icon className="h-4 w-4" />
                 {action.title}
               </Button>
             ))}
           </div>
         </motion.div>
 
         {/* Modules Grid */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
         >
           <h2 className="text-lg font-semibold text-foreground mb-4">Modules</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             {modules.map((module, index) => (
               <motion.div
                 key={module.title}
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ delay: 0.5 + index * 0.05 }}
                 whileHover={{ scale: 1.02 }}
               >
                 <Card
                   className="glass-card border-border/50 hover:border-primary/30 cursor-pointer transition-all h-full"
                   onClick={() => navigate(module.path)}
                 >
                   <CardContent className="p-6">
                     <div className={`w-12 h-12 rounded-xl ${module.color} flex items-center justify-center mb-4`}>
                       <module.icon className="h-6 w-6" />
                     </div>
                     <h3 className="font-semibold text-foreground mb-1">{module.title}</h3>
                     <p className="text-sm text-muted-foreground">{module.description}</p>
                   </CardContent>
                 </Card>
               </motion.div>
             ))}
           </div>
         </motion.div>
       </main>
 
       {/* Footer */}
       <footer className="border-t border-border py-6 px-4 md:px-8">
         <p className="text-center text-sm text-muted-foreground">
           Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
         </p>
       </footer>
     </div>
   );
 }