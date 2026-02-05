 import { useNavigate, useLocation } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Bell, Lock, LogOut, Wallet } from 'lucide-react';
 import { useWallet } from '@/hooks/useWallet';
 
 const pageTitles: Record<string, string> = {
   '/reseller-dashboard': 'Reseller Dashboard',
   '/reseller-dashboard?tab=keys': 'Generate Keys',
   '/reseller-dashboard?tab=clients': 'My Clients',
   '/reseller-dashboard?tab=wallet': 'Add Balance',
   '/reseller-dashboard?tab=referral': 'Refer & Earn',
   '/reseller-dashboard?tab=password': 'Change Password',
 };
 
 export function ResellerHeader() {
   const navigate = useNavigate();
   const location = useLocation();
   const { user, signOut } = useAuth();
   const { wallet } = useWallet();
 
   const currentPath = location.pathname + location.search;
   const pageTitle = pageTitles[currentPath] || 'Reseller Dashboard';
   const canGoBack = location.search !== '';
 
   const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'R';
 
   return (
     <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6">
       {/* Left section */}
       <div className="flex items-center gap-4">
         {canGoBack && (
           <Button
             variant="ghost"
             size="icon"
             onClick={() => navigate('/reseller-dashboard')}
             className="text-muted-foreground hover:text-foreground"
           >
             <ArrowLeft className="h-5 w-5" />
           </Button>
         )}
         <div>
           <h1 className="font-display text-xl font-bold text-foreground">
             {pageTitle}
           </h1>
           <Badge variant="outline" className="mt-0.5 text-xs border-secondary/50 text-secondary">
             Reseller Account
           </Badge>
         </div>
       </div>
 
       {/* Right section */}
       <div className="flex items-center gap-3">
         {/* Wallet Balance */}
         <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
           <Wallet className="h-4 w-4 text-primary" />
           <span className="font-semibold text-foreground">
             ${wallet?.balance?.toFixed(2) || '0.00'}
           </span>
         </div>
 
         {/* Notifications */}
         <Button
           variant="ghost"
           size="icon"
           className="relative text-muted-foreground hover:text-foreground"
         >
           <Bell className="h-5 w-5" />
           <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
             2
           </span>
         </Button>
 
         {/* User menu */}
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button
               variant="ghost"
               className="relative h-10 w-10 rounded-full"
             >
               <Avatar className="h-9 w-9 border-2 border-secondary/30">
                 <AvatarImage src="" alt={user?.email || ''} />
                 <AvatarFallback className="bg-muted text-foreground font-medium">
                   {userInitials}
                 </AvatarFallback>
               </Avatar>
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent className="w-56 bg-popover border-border" align="end">
             <DropdownMenuLabel className="font-normal">
               <div className="flex flex-col space-y-1">
                 <p className="text-sm font-medium text-foreground">
                   {user?.user_metadata?.full_name || user?.email}
                 </p>
                 <p className="text-xs text-muted-foreground">
                   Reseller Account
                 </p>
               </div>
             </DropdownMenuLabel>
             <DropdownMenuSeparator className="bg-border" />
             <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/reseller-dashboard?tab=password')}>
               <Lock className="mr-2 h-4 w-4" />
               <span>Change Password</span>
             </DropdownMenuItem>
             <DropdownMenuSeparator className="bg-border" />
             <DropdownMenuItem
               className="cursor-pointer text-destructive focus:text-destructive"
               onClick={signOut}
             >
               <LogOut className="mr-2 h-4 w-4" />
               <span>Log out</span>
             </DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
       </div>
     </header>
   );
 }