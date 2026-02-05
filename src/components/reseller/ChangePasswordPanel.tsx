 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import {
   Lock,
   Eye,
   EyeOff,
   CheckCircle2,
   AlertCircle,
   Loader2,
 } from 'lucide-react';
 
 export function ChangePasswordPanel() {
   const [currentPassword, setCurrentPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [showCurrent, setShowCurrent] = useState(false);
   const [showNew, setShowNew] = useState(false);
   const [showConfirm, setShowConfirm] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
 
   const passwordRequirements = [
     { label: 'At least 8 characters', met: newPassword.length >= 8 },
     { label: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
     { label: 'Contains lowercase letter', met: /[a-z]/.test(newPassword) },
     { label: 'Contains a number', met: /[0-9]/.test(newPassword) },
     { label: 'Passwords match', met: newPassword === confirmPassword && newPassword.length > 0 },
   ];
 
   const allRequirementsMet = passwordRequirements.every(req => req.met);
 
   const handleChangePassword = async () => {
     if (!allRequirementsMet) {
       toast.error('Please meet all password requirements');
       return;
     }
 
     setIsLoading(true);
 
     try {
       const { error } = await supabase.auth.updateUser({
         password: newPassword,
       });
 
       if (error) throw error;
 
       toast.success('Password changed successfully!');
       setCurrentPassword('');
       setNewPassword('');
       setConfirmPassword('');
     } catch (error: any) {
       toast.error(error.message || 'Failed to change password');
     } finally {
       setIsLoading(false);
     }
   };
 
   return (
     <div className="max-w-xl mx-auto space-y-6">
       <Card className="glass-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Lock className="h-5 w-5 text-primary" />
             Change Password
           </CardTitle>
           <CardDescription>
             Update your account password. Make sure to use a strong password.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           {/* Current Password */}
           <div className="space-y-2">
             <Label>Current Password</Label>
             <div className="relative">
               <Input
                 type={showCurrent ? 'text' : 'password'}
                 value={currentPassword}
                 onChange={(e) => setCurrentPassword(e.target.value)}
                 placeholder="Enter current password"
               />
               <Button
                 type="button"
                 variant="ghost"
                 size="icon"
                 className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                 onClick={() => setShowCurrent(!showCurrent)}
               >
                 {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
               </Button>
             </div>
           </div>
 
           {/* New Password */}
           <div className="space-y-2">
             <Label>New Password</Label>
             <div className="relative">
               <Input
                 type={showNew ? 'text' : 'password'}
                 value={newPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
                 placeholder="Enter new password"
               />
               <Button
                 type="button"
                 variant="ghost"
                 size="icon"
                 className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                 onClick={() => setShowNew(!showNew)}
               >
                 {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
               </Button>
             </div>
           </div>
 
           {/* Confirm Password */}
           <div className="space-y-2">
             <Label>Confirm New Password</Label>
             <div className="relative">
               <Input
                 type={showConfirm ? 'text' : 'password'}
                 value={confirmPassword}
                 onChange={(e) => setConfirmPassword(e.target.value)}
                 placeholder="Confirm new password"
               />
               <Button
                 type="button"
                 variant="ghost"
                 size="icon"
                 className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                 onClick={() => setShowConfirm(!showConfirm)}
               >
                 {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
               </Button>
             </div>
           </div>
 
           {/* Password Requirements */}
           <div className="p-4 rounded-lg bg-muted/50 border border-border">
             <p className="text-sm font-medium text-foreground mb-3">Password Requirements:</p>
             <div className="space-y-2">
               {passwordRequirements.map((req, index) => (
                 <div key={index} className="flex items-center gap-2">
                   {req.met ? (
                     <CheckCircle2 className="h-4 w-4 text-green-500" />
                   ) : (
                     <AlertCircle className="h-4 w-4 text-muted-foreground" />
                   )}
                   <span className={`text-sm ${req.met ? 'text-green-500' : 'text-muted-foreground'}`}>
                     {req.label}
                   </span>
                 </div>
               ))}
             </div>
           </div>
 
           <Button
             className="w-full"
             size="lg"
             disabled={!allRequirementsMet || isLoading}
             onClick={handleChangePassword}
           >
             {isLoading ? (
               <>
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 Changing Password...
               </>
             ) : (
               <>
                 <Lock className="h-4 w-4 mr-2" />
                 Change Password
               </>
             )}
           </Button>
         </CardContent>
       </Card>
     </div>
   );
 }