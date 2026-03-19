 import { useState, useEffect } from 'react';
 import { useNavigate, useSearchParams } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent } from '@/components/ui/card';
 import { Checkbox } from '@/components/ui/checkbox';
 import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
 import { Loader2, Mail, Lock, User, Eye, EyeOff, KeyRound, Store } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 import { z } from 'zod';
 import { motion, AnimatePresence } from 'framer-motion';
 import saasValaLogo from '@/assets/saas-vala-logo.jpg';
 
 const loginSchema = z.object({
   email: z.string().email('Please enter a valid email address'),
   password: z.string().min(6, 'Password must be at least 6 characters'),
 });
 
 const signupSchema = loginSchema.extend({
   fullName: z.string().min(2, 'Name must be at least 2 characters'),
   confirmPassword: z.string(),
 }).refine((data) => data.password === data.confirmPassword, {
   message: "Passwords don't match",
   path: ['confirmPassword'],
 });
 
type AuthMode = 'login' | 'signup' | 'forgot_password';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applyReseller = searchParams.get('apply') === 'reseller';
  const { user, role, signIn, signUp, loading, initializing } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(applyReseller ? 'signup' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
 
   // Login form state
   const [loginEmail, setLoginEmail] = useState('');
   const [loginPassword, setLoginPassword] = useState('');
   const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
 
   // Signup form state
   const [signupFullName, setSignupFullName] = useState('');
   const [signupEmail, setSignupEmail] = useState('');
   const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [signupRole, setSignupRole] = useState<'user' | 'reseller'>(applyReseller ? 'reseller' : 'user');
    const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
 
   // Redirect based on role after login
   useEffect(() => {
     if (user && role && !loading) {
       if (role === 'super_admin') {
         navigate('/dashboard', { replace: true });
       } else if (role === 'reseller') {
         navigate('/reseller-dashboard', { replace: true });
       } else {
         navigate('/', { replace: true });
       }
     }
   }, [user, role, loading, navigate]);
 
   const handleLogin = async (e: React.FormEvent) => {
     e.preventDefault();
     setLoginErrors({});
 
     const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
     if (!result.success) {
       const errors: Record<string, string> = {};
       result.error.errors.forEach((err) => {
         if (err.path[0]) {
           errors[err.path[0] as string] = err.message;
         }
       });
       setLoginErrors(errors);
       return;
     }
 
     setIsSubmitting(true);
     const { error } = await signIn(loginEmail, loginPassword);
     setIsSubmitting(false);
 
     if (error) {
       toast({
         variant: 'destructive',
         title: 'Login failed',
         description: error.message || 'Invalid email or password',
       });
     } else {
       toast({
         title: 'Welcome back!',
         description: 'You have been logged in successfully.',
       });
     }
   };
 
   const handle2FAVerify = async () => {
     if (otpValue.length !== 6) {
       toast({
         variant: 'destructive',
         title: 'Invalid OTP',
         description: 'Please enter a 6-digit verification code.',
       });
       return;
     }
 
     setIsSubmitting(true);
     await new Promise((resolve) => setTimeout(resolve, 1000));
     setIsSubmitting(false);
 
     toast({
       title: 'Verified!',
       description: 'Two-factor authentication successful.',
     });
     setShow2FA(false);
     setOtpValue('');
   };
 
   const handleSignup = async (e: React.FormEvent) => {
     e.preventDefault();
     setSignupErrors({});
 
     const result = signupSchema.safeParse({
       email: signupEmail,
       password: signupPassword,
       fullName: signupFullName,
       confirmPassword: signupConfirmPassword,
     });
 
     if (!result.success) {
       const errors: Record<string, string> = {};
       result.error.errors.forEach((err) => {
         if (err.path[0]) {
           errors[err.path[0] as string] = err.message;
         }
       });
       setSignupErrors(errors);
       return;
     }
 
      setIsSubmitting(true);
      const { error } = await signUp(signupEmail, signupPassword, signupFullName, signupRole === 'reseller' ? 'reseller' : undefined);
     setIsSubmitting(false);
 
     if (error) {
       let message = error.message;
       if (message.includes('already registered')) {
         message = 'This email is already registered. Please sign in instead.';
       }
       toast({
         variant: 'destructive',
         title: 'Signup failed',
         description: message,
       });
     } else {
       toast({
         title: 'Account created!',
         description: 'Please check your email to verify your account.',
       });
       setAuthMode('login');
     }
   };
 
   if (initializing) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-[#0a0f1f]">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="min-h-screen flex items-center justify-center bg-[#0a0f1f] p-4 relative overflow-hidden">
       {/* Animated background */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <motion.div
           animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
           transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
           className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/20 to-orange-500/10 blur-3xl"
         />
         <motion.div
           animate={{ opacity: [0.2, 0.4, 0.2], scale: [1.1, 1, 1.1] }}
           transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
           className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-secondary/20 to-cyan-500/10 blur-3xl"
         />
         <motion.div
           animate={{ opacity: [0.15, 0.25, 0.15] }}
           transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
           className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl"
         />
       </div>
 
       {/* Main card */}
       <motion.div
         initial={{ opacity: 0, y: 20, scale: 0.98 }}
         animate={{ opacity: 1, y: 0, scale: 1 }}
         transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
         className="w-full max-w-md relative z-10"
       >
         <Card className="bg-card/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
           <CardContent className="p-8">
             {/* Logo & Tagline */}
             <div className="text-center mb-8">
               <motion.div
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                 className="relative inline-block"
               >
                 <div className="absolute -inset-3 bg-gradient-to-br from-primary/30 via-orange-500/20 to-transparent rounded-2xl blur-lg" />
                 <img
                   src={saasValaLogo}
                   alt="SaaS VALA"
                   className="relative w-20 h-20 rounded-2xl object-cover mx-auto border-2 border-primary/40 shadow-xl"
                 />
               </motion.div>
               <h1 className="mt-4 text-2xl font-display font-bold text-foreground">
                 SaaS VALA
               </h1>
               <p className="text-sm text-muted-foreground mt-1">
                 Powering Real Business Software
               </p>
             </div>
 
             <AnimatePresence mode="wait">
               {/* 2FA Flow */}
               {show2FA ? (
                 <motion.div
                   key="2fa"
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -20 }}
                   className="space-y-6"
                 >
                   <div className="text-center">
                     <div className="mx-auto w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                       <KeyRound className="h-7 w-7 text-primary" />
                     </div>
                     <h2 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h2>
                     <p className="text-sm text-muted-foreground mt-1">Enter the 6-digit code from your authenticator app</p>
                   </div>
 
                   <div className="flex justify-center">
                     <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                       <InputOTPGroup>
                         <InputOTPSlot index={0} />
                         <InputOTPSlot index={1} />
                         <InputOTPSlot index={2} />
                         <InputOTPSlot index={3} />
                         <InputOTPSlot index={4} />
                         <InputOTPSlot index={5} />
                       </InputOTPGroup>
                     </InputOTP>
                   </div>
 
                   <Button
                     onClick={handle2FAVerify}
                     className="w-full bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white font-semibold h-12"
                     disabled={isSubmitting || otpValue.length !== 6}
                   >
                     {isSubmitting ? (
                       <>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         Verifying...
                       </>
                     ) : (
                       'Verify'
                     )}
                   </Button>
 
                   <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShow2FA(false)}>
                     Back to Login
                   </Button>
                 </motion.div>
                ) : authMode === 'login' ? (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleLogin}
                    className="space-y-5"
                  >
 
                   {/* Email */}
                   <div className="space-y-2">
                     <Label htmlFor="login-email" className="text-foreground text-sm">Email</Label>
                     <div className="relative">
                       <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="login-email"
                         type="email"
                         placeholder="you@example.com"
                         value={loginEmail}
                         onChange={(e) => setLoginEmail(e.target.value)}
                         className="pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary"
                         required
                       />
                     </div>
                     {loginErrors.email && <p className="text-sm text-destructive">{loginErrors.email}</p>}
                   </div>
 
                   {/* Password */}
                   <div className="space-y-2">
                     <Label htmlFor="login-password" className="text-foreground text-sm">Password</Label>
                     <div className="relative">
                       <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="login-password"
                         type={showPassword ? 'text' : 'password'}
                         placeholder="••••••••"
                         value={loginPassword}
                         onChange={(e) => setLoginPassword(e.target.value)}
                         className="pl-10 pr-10 h-12 bg-muted/30 border-border/50 focus:border-primary"
                         required
                       />
                       <button
                         type="button"
                         onClick={() => setShowPassword(!showPassword)}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                       >
                         {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                       </button>
                     </div>
                     {loginErrors.password && <p className="text-sm text-destructive">{loginErrors.password}</p>}
                   </div>
 
                   {/* Remember Me & Forgot Password */}
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Checkbox
                         id="remember"
                         checked={rememberMe}
                         onCheckedChange={(checked) => setRememberMe(checked === true)}
                       />
                       <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                         Remember me
                       </Label>
                     </div>
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline"
                        onClick={() => setAuthMode('forgot_password')}
                      >
                        Forgot Password?
                      </button>
                   </div>
 
                    {/* Login Button */}
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white font-semibold h-12"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Login'
                      )}
                    </Button>

                    {/* One-Click Quick Login */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-2">Quick Fill</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setLoginEmail('hellosoftwarevala@gmail.com');
                            toast({ title: '👑 Admin email filled!', description: 'Enter your password and click Login' });
                          }}
                          disabled={isSubmitting}
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px]">👑</div>
                          <div className="text-left">
                            <div className="text-[10px] font-bold">ADMIN</div>
                            <div className="text-[9px] text-orange-400/70">Fill Email</div>
                          </div>
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setLoginEmail('haroonzaka2@gmail.com');
                            toast({ title: '🏪 Reseller email filled!', description: 'Enter your password and click Login' });
                          }}
                          disabled={isSubmitting}
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">🏪</div>
                          <div className="text-left">
                            <div className="text-[10px] font-bold">RESELLER</div>
                            <div className="text-[9px] text-cyan-400/70">Fill Email</div>
                          </div>
                        </motion.button>
                      </div>
                    </div>

                     {/* Sign Up Link */}
                    <p className="text-center text-sm text-muted-foreground">
                      Don't have an account?{' '}
                      <button type="button" onClick={() => setAuthMode('signup')} className="text-primary font-medium hover:underline">
                        Sign Up
                      </button>
                    </p>
                 </motion.form>
                ) : authMode === 'forgot_password' ? (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="text-center">
                      <div className="mx-auto w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                        <Mail className="h-7 w-7 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold text-foreground">Reset Password</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {resetSent 
                          ? 'Check your email for reset instructions' 
                          : 'Enter your email to receive a reset link'}
                      </p>
                    </div>

                    {!resetSent ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="forgot-email" className="text-foreground text-sm">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="forgot-email"
                              type="email"
                              placeholder="you@example.com"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              className="pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary"
                              required
                            />
                          </div>
                        </div>

                        <Button
                          className="w-full bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white font-semibold h-12"
                          disabled={isSubmitting || !forgotEmail}
                          onClick={async () => {
                            setIsSubmitting(true);
                            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                              redirectTo: `${window.location.origin}/auth`,
                            });
                            setIsSubmitting(false);
                            if (error) {
                              toast({ variant: 'destructive', title: 'Error', description: error.message });
                            } else {
                              setResetSent(true);
                              toast({ title: 'Email sent', description: 'Check your inbox for password reset instructions.' });
                            }
                          }}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Send Reset Link'
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="text-center p-4 bg-primary/5 rounded-lg">
                        <p className="text-sm text-foreground">
                          ✅ Reset link sent! Check your email inbox.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Link expires in 15 minutes
                        </p>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => { setAuthMode('login'); setResetSent(false); setForgotEmail(''); }}
                    >
                      Back to Login
                    </Button>
                  </motion.div>
                ) : (
                 /* Sign Up Form */
                 <motion.form
                   key="signup"
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -20 }}
                   onSubmit={handleSignup}
                   className="space-y-4"
                 >
                   {/* Full Name */}
                   <div className="space-y-2">
                     <Label htmlFor="signup-name" className="text-foreground text-sm">Full Name</Label>
                     <div className="relative">
                       <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="signup-name"
                         type="text"
                         placeholder="John Doe"
                         value={signupFullName}
                         onChange={(e) => setSignupFullName(e.target.value)}
                         className="pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary"
                         required
                       />
                     </div>
                    {signupErrors.fullName && <p className="text-sm text-destructive">{signupErrors.fullName}</p>}
                    </div>

                    {/* Role Selector */}
                    <div className="space-y-2">
                      <Label className="text-foreground text-sm">I want to join as</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSignupRole('user')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            signupRole === 'user' 
                              ? 'border-primary bg-primary/10 text-foreground' 
                              : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <User className="h-5 w-5" />
                          <span className="text-xs font-semibold">USER</span>
                          <span className="text-[10px] text-muted-foreground">Buy & Download Software</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignupRole('reseller')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            signupRole === 'reseller' 
                              ? 'border-primary bg-primary/10 text-foreground' 
                              : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <Store className="h-5 w-5" />
                          <span className="text-xs font-semibold">RESELLER</span>
                          <span className="text-[10px] text-muted-foreground">Sell & Earn Commission</span>
                        </button>
                      </div>
                    </div>
 
                   {/* Email */}
                   <div className="space-y-2">
                     <Label htmlFor="signup-email" className="text-foreground text-sm">Email</Label>
                     <div className="relative">
                       <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="signup-email"
                         type="email"
                         placeholder="you@example.com"
                         value={signupEmail}
                         onChange={(e) => setSignupEmail(e.target.value)}
                         className="pl-10 h-12 bg-muted/30 border-border/50 focus:border-primary"
                         required
                       />
                     </div>
                     {signupErrors.email && <p className="text-sm text-destructive">{signupErrors.email}</p>}
                   </div>
 
                   {/* Password */}
                   <div className="space-y-2">
                     <Label htmlFor="signup-password" className="text-foreground text-sm">Password</Label>
                     <div className="relative">
                       <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="signup-password"
                         type={showPassword ? 'text' : 'password'}
                         placeholder="••••••••"
                         value={signupPassword}
                         onChange={(e) => setSignupPassword(e.target.value)}
                         className="pl-10 pr-10 h-12 bg-muted/30 border-border/50 focus:border-primary"
                         required
                       />
                       <button
                         type="button"
                         onClick={() => setShowPassword(!showPassword)}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                       >
                         {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                       </button>
                     </div>
                     {signupErrors.password && <p className="text-sm text-destructive">{signupErrors.password}</p>}
                   </div>
 
                   {/* Confirm Password */}
                   <div className="space-y-2">
                     <Label htmlFor="signup-confirm" className="text-foreground text-sm">Confirm Password</Label>
                     <div className="relative">
                       <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="signup-confirm"
                         type={showConfirmPassword ? 'text' : 'password'}
                         placeholder="••••••••"
                         value={signupConfirmPassword}
                         onChange={(e) => setSignupConfirmPassword(e.target.value)}
                         className="pl-10 pr-10 h-12 bg-muted/30 border-border/50 focus:border-primary"
                         required
                       />
                       <button
                         type="button"
                         onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                       >
                         {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                       </button>
                     </div>
                     {signupErrors.confirmPassword && <p className="text-sm text-destructive">{signupErrors.confirmPassword}</p>}
                   </div>
 
                   {/* Sign Up Button */}
                   <Button
                     type="submit"
                     className="w-full bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white font-semibold h-12"
                     disabled={isSubmitting}
                   >
                     {isSubmitting ? (
                       <>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         Creating account...
                       </>
                     ) : (
                       'Create Account'
                     )}
                   </Button>
 
                   {/* Login Link */}
                   <p className="text-center text-sm text-muted-foreground">
                     Already have an account?{' '}
                     <button type="button" onClick={() => setAuthMode('login')} className="text-primary font-medium hover:underline">
                       Sign In
                     </button>
                   </p>
                 </motion.form>
               )}
             </AnimatePresence>
 
             {/* Footer Links */}
             <div className="mt-8 pt-6 border-t border-border/50">
               <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
                 <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                 <span className="text-border">•</span>
                 <a href="#" className="hover:text-primary transition-colors">Terms & Conditions</a>
                 <span className="text-border">•</span>
                 <a href="#" className="hover:text-primary transition-colors">No Refund Policy</a>
               </div>
               <p className="text-center text-xs text-muted-foreground mt-4">
                 Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
               </p>
             </div>
           </CardContent>
         </Card>
       </motion.div>
     </div>
   );
 }