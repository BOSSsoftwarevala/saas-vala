 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import { useAuth } from '@/hooks/useAuth';
 import { toast } from 'sonner';
 import {
   Share2,
   Copy,
   Users,
   DollarSign,
   Gift,
   Link,
   Twitter,
   Facebook,
   Send,
 } from 'lucide-react';
 
 export function ReferralPanel() {
   const { user } = useAuth();
   const referralCode = user?.id?.slice(0, 8).toUpperCase() || 'XXXXX';
   const referralLink = `https://saasvala.com/ref/${referralCode}`;
 
   const [referrals] = useState([
     { name: 'Rahul Mehta', date: '2024-01-15', status: 'active', earned: 25 },
     { name: 'Sneha Gupta', date: '2024-01-10', status: 'pending', earned: 0 },
     { name: 'Arun Kumar', date: '2024-01-05', status: 'active', earned: 50 },
   ]);
 
   const totalEarned = referrals.reduce((sum, r) => sum + r.earned, 0);
   const totalReferrals = referrals.length;
   const activeReferrals = referrals.filter(r => r.status === 'active').length;
 
   const copyLink = () => {
     navigator.clipboard.writeText(referralLink);
     toast.success('Referral link copied!');
   };
 
   const copyCode = () => {
     navigator.clipboard.writeText(referralCode);
     toast.success('Referral code copied!');
   };
 
   const shareOn = (platform: string) => {
     const text = `Join SaaS VALA and get premium software at best prices! Use my referral code: ${referralCode}`;
     let url = '';
     
     switch (platform) {
       case 'twitter':
         url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`;
         break;
       case 'facebook':
         url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;
         break;
       case 'whatsapp':
         url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + referralLink)}`;
         break;
     }
     
     window.open(url, '_blank');
   };
 
   return (
     <div className="space-y-6">
       {/* Stats */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                 <Users className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Total Referrals</p>
                 <p className="text-xl font-bold text-foreground">{totalReferrals}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                 <Users className="h-5 w-5 text-green-500" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Active Referrals</p>
                 <p className="text-xl font-bold text-foreground">{activeReferrals}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                 <DollarSign className="h-5 w-5 text-secondary" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Total Earned</p>
                 <p className="text-xl font-bold text-foreground">${totalEarned}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Referral Link & Code */}
       <Card className="glass-card border-primary/30">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Gift className="h-5 w-5 text-primary" />
             Your Referral Program
           </CardTitle>
           <CardDescription>
             Earn $25 for every referral that makes their first purchase!
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           {/* Referral Code */}
           <div className="space-y-2">
             <label className="text-sm font-medium text-muted-foreground">Your Referral Code</label>
             <div className="flex items-center gap-2">
               <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border">
                 <code className="text-xl font-bold font-mono text-primary">{referralCode}</code>
               </div>
               <Button variant="outline" onClick={copyCode}>
                 <Copy className="h-4 w-4 mr-2" />
                 Copy
               </Button>
             </div>
           </div>
 
           {/* Referral Link */}
           <div className="space-y-2">
             <label className="text-sm font-medium text-muted-foreground">Your Referral Link</label>
             <div className="flex items-center gap-2">
               <Input
                 value={referralLink}
                 readOnly
                 className="font-mono text-sm"
               />
               <Button onClick={copyLink}>
                 <Link className="h-4 w-4 mr-2" />
                 Copy Link
               </Button>
             </div>
           </div>
 
           {/* Share Buttons */}
           <div className="pt-4 border-t border-border">
             <p className="text-sm text-muted-foreground mb-3">Share on social media:</p>
             <div className="flex flex-wrap gap-2">
               <Button variant="outline" onClick={() => shareOn('whatsapp')} className="bg-green-500/10 hover:bg-green-500/20 border-green-500/30">
                 <Send className="h-4 w-4 mr-2 text-green-500" />
                 WhatsApp
               </Button>
               <Button variant="outline" onClick={() => shareOn('twitter')} className="bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30">
                 <Twitter className="h-4 w-4 mr-2 text-blue-500" />
                 Twitter
               </Button>
               <Button variant="outline" onClick={() => shareOn('facebook')} className="bg-blue-600/10 hover:bg-blue-600/20 border-blue-600/30">
                 <Facebook className="h-4 w-4 mr-2 text-blue-600" />
                 Facebook
               </Button>
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Referral History */}
       <Card className="glass-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Share2 className="h-5 w-5 text-primary" />
             Referral History
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-3">
             {referrals.map((referral, index) => (
               <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                 <div>
                   <p className="font-medium text-foreground">{referral.name}</p>
                   <p className="text-sm text-muted-foreground">Joined: {referral.date}</p>
                 </div>
                 <div className="flex items-center gap-3">
                   <Badge
                     variant="outline"
                     className={referral.status === 'active' 
                       ? 'bg-green-500/20 text-green-500 border-green-500/30'
                       : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                     }
                   >
                     {referral.status}
                   </Badge>
                   {referral.earned > 0 && (
                     <span className="font-semibold text-green-500">+${referral.earned}</span>
                   )}
                 </div>
               </div>
             ))}
           </div>
         </CardContent>
       </Card>
     </div>
   );
 }