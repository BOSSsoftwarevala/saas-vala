import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';
import { SupportTicket } from '@/hooks/useSupportChat';

interface SupportHeaderProps {
  activeTicket: SupportTicket | null;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function SupportHeader({ activeTicket, onBack, showBackButton }: SupportHeaderProps) {
  return (
    <div className="bg-[#075E54] text-white">
      {/* Main header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <div className="h-10 w-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
          <img 
            src={saasValaLogo} 
            alt="SaaS Vala Support" 
            className="h-full w-full object-cover"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate">
            Support Chat
          </h1>
          {activeTicket && (
            <p className="text-xs text-white/70 truncate">
              ID: {activeTicket.ticket_number}
            </p>
          )}
        </div>
        
        {activeTicket && (
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            activeTicket.status === 'open' ? 'bg-green-500/20 text-green-300' :
            activeTicket.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
            activeTicket.status === 'resolved' ? 'bg-blue-500/20 text-blue-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            {activeTicket.status.toUpperCase()}
          </div>
        )}
      </div>

      {/* Security disclaimer */}
      <div className="bg-[#128C7E] px-4 py-2 flex items-start gap-2">
        <Shield className="h-4 w-4 text-yellow-300 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/90 leading-relaxed">
          <span className="font-semibold text-yellow-300">⚠️ SECURITY NOTICE:</span>{' '}
          Do not share mobile number, email, server IP, or unknown details. This chat is monitored for safety.
        </p>
      </div>
    </div>
  );
}
