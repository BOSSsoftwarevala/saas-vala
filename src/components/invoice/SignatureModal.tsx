import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, RefreshCw, PenTool, CheckCircle2, Mail } from 'lucide-react';
import { Invoice, useInvoices } from '@/hooks/useInvoices';
import { toast } from 'sonner';

interface SignatureModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'email' | 'otp' | 'signature' | 'success';

export function SignatureModal({ invoice, open, onOpenChange }: SignatureModalProps) {
  const { saveSignature } = useInvoices();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [_otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (invoice) {
      setEmail(invoice.customer_email);
    }
  }, [invoice]);

  useEffect(() => {
    if (step === 'signature' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [step]);

  const handleSendOTP = async () => {
    if (!email) {
      toast.error('Please enter email');
      return;
    }
    
    setLoading(true);
    // Simulate OTP send - in production this would call an edge function
    await new Promise(resolve => setTimeout(resolve, 1500));
    setOtpSent(true);
    setLoading(false);
    toast.success(`OTP sent to ${email}`);
    setStep('otp');
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    // Simulate OTP verification
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo, accept any 6-digit OTP
    if (otp.length === 6) {
      setLoading(false);
      toast.success('OTP verified');
      setStep('signature');
    } else {
      setLoading(false);
      toast.error('Invalid OTP');
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = async () => {
    if (!invoice || !canvasRef.current) return;

    const signatureData = canvasRef.current.toDataURL('image/png');
    
    // Check if canvas has been drawn on
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const isBlank = imageData.data.every((value, index) => {
      // Check if pixel is white (255, 255, 255, 255)
      return index % 4 === 3 ? value === 255 : value === 255;
    });

    if (isBlank) {
      toast.error('Please draw your signature');
      return;
    }

    setLoading(true);
    
    // Get IP address (simulated for demo)
    const signerIp = '192.168.1.1'; // In production, get from server
    
    const success = await saveSignature(invoice.id, signatureData, signerIp);
    
    setLoading(false);
    
    if (success) {
      setStep('success');
    }
  };

  const handleClose = () => {
    setStep('email');
    setOtp('');
    setOtpSent(false);
    onOpenChange(false);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            Digital Signature
          </DialogTitle>
          <DialogDescription>
            Sign invoice {invoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
              <p className="text-xs text-muted-foreground">
                We'll send a verification OTP to this email
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSendOTP} disabled={loading || !email}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Mail className="h-4 w-4 mr-2" />
                Send OTP
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">Enter the 6-digit code sent to</p>
              <p className="font-medium text-foreground">{email}</p>
            </div>
            
            <div className="flex justify-center">
              <InputOTP value={otp} onChange={setOtp} maxLength={6}>
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
              variant="link"
              className="w-full text-muted-foreground"
              onClick={handleSendOTP}
              disabled={loading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Resend OTP
            </Button>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('email')}>Back</Button>
              <Button onClick={handleVerifyOTP} disabled={loading || otp.length !== 6}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify OTP
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'signature' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Draw your signature below
              </p>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={clearCanvas}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Clear
            </Button>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('otp')}>Back</Button>
              <Button onClick={handleSaveSignature} disabled={loading} className="bg-orange-gradient text-white">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Signature
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-foreground">Signature Saved!</h3>
              <p className="text-muted-foreground">
                Invoice {invoice.invoice_number} has been signed successfully.
              </p>
            </div>
            <Button onClick={handleClose} className="bg-orange-gradient text-white">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
