import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface RefundPolicyCardProps {
  agreed: boolean;
  onAgreeChange: (agreed: boolean) => void;
  className?: string;
}

const policyPoints = [
  'Digital delivery is instant and irreversible',
  'Demo available before payment to test features',
  'License activation happens immediately',
  'Fair pricing without hidden charges',
  'Support provided even after purchase',
];

export function RefundPolicyCard({ agreed, onAgreeChange, className }: RefundPolicyCardProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-slate-50 rounded-lg border border-sky-200 p-4 space-y-3',
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-sky-600" />
        </div>
        <h4 className="font-display font-bold text-slate-800 tracking-wide text-sm uppercase">
          No Refund Policy
        </h4>
      </div>

      {/* Body Text */}
      <div className="text-sm text-slate-700 leading-relaxed space-y-2">
        <p>
          This is a digital product.
          Once access, demo, APK, or source files are delivered,
          they can be copied or used immediately.
          Because of this, refunds are not possible.
        </p>
        <p className="font-semibold text-slate-800">
          We ensure full demo access before purchase.
        </p>
      </div>

      {/* Bullet Points */}
      <ul className="space-y-1.5">
        {policyPoints.map((point, index) => (
          <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      {/* Consent Checkbox */}
      <div className="pt-2 border-t border-sky-100">
        <div className="flex items-start gap-3">
          <Checkbox
            id="refund-policy-agree"
            checked={agreed}
            onCheckedChange={(checked) => onAgreeChange(checked === true)}
            className="mt-0.5 border-sky-400 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600"
          />
          <Label 
            htmlFor="refund-policy-agree" 
            className="text-sm text-slate-700 font-medium cursor-pointer leading-tight"
          >
            I understand and agree to the No Refund Policy
          </Label>
        </div>
      </div>
    </div>
  );
}
