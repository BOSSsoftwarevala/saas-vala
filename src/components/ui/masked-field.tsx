 import { useState } from 'react';
 import { cn } from '@/lib/utils';
 import { Eye, EyeOff, Copy, Check } from 'lucide-react';
 import { Button } from './button';
 import { toast } from 'sonner';
 import { maskEmail, maskPhone, maskName, maskSensitiveData } from '@/lib/dataMasking';
 
 interface MaskedFieldProps {
   value: string;
   type: 'email' | 'phone' | 'name' | 'auto';
   className?: string;
   revealOnHover?: boolean;
   revealOnClick?: boolean;
   copyable?: boolean;
   showToggle?: boolean;
 }
 
 export function MaskedField({
   value,
   type,
   className,
   revealOnHover = true,
   revealOnClick = false,
   copyable = true,
   showToggle = true,
 }: MaskedFieldProps) {
   const [isRevealed, setIsRevealed] = useState(false);
   const [copied, setCopied] = useState(false);
 
   const getMaskedValue = () => {
     switch (type) {
       case 'email':
         return maskEmail(value, true);
       case 'phone':
         return maskPhone(value, true);
       case 'name':
         return maskName(value, true);
       case 'auto':
       default:
         return maskSensitiveData(value);
     }
   };
 
   const handleCopy = async () => {
     try {
       await navigator.clipboard.writeText(value);
       setCopied(true);
       toast.success('Copied to clipboard');
       setTimeout(() => setCopied(false), 2000);
     } catch {
       toast.error('Failed to copy');
     }
   };
 
   const displayValue = isRevealed ? value : getMaskedValue();
 
   return (
     <div
       className={cn(
         "group inline-flex items-center gap-1.5 font-mono text-sm",
         revealOnHover && "cursor-pointer",
         className
       )}
       onMouseEnter={() => revealOnHover && setIsRevealed(true)}
       onMouseLeave={() => revealOnHover && setIsRevealed(false)}
       onClick={() => revealOnClick && setIsRevealed(!isRevealed)}
     >
       <span className={cn(
         "transition-all duration-200",
         !isRevealed && "text-muted-foreground"
       )}>
         {displayValue}
       </span>
       
       <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
         {showToggle && (
           <Button
             variant="ghost"
             size="icon"
             className="h-6 w-6"
             onClick={(e) => {
               e.stopPropagation();
               setIsRevealed(!isRevealed);
             }}
           >
             {isRevealed ? (
               <EyeOff className="h-3 w-3" />
             ) : (
               <Eye className="h-3 w-3" />
             )}
           </Button>
         )}
         
         {copyable && (
           <Button
             variant="ghost"
             size="icon"
             className="h-6 w-6"
             onClick={(e) => {
               e.stopPropagation();
               handleCopy();
             }}
           >
             {copied ? (
               <Check className="h-3 w-3 text-green-500" />
             ) : (
               <Copy className="h-3 w-3" />
             )}
           </Button>
         )}
       </div>
     </div>
   );
 }