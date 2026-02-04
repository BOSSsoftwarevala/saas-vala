import { format } from 'date-fns';
import { MessageSquare, Clock, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { SupportTicket } from '@/hooks/useSupportChat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

interface TicketListProps {
  tickets: SupportTicket[];
  activeTicketId?: string;
  onSelectTicket: (ticket: SupportTicket) => void;
  onNewTicket: () => void;
  loading?: boolean;
  isStaff: boolean;
}

const statusIcons = {
  pending: Clock,
  open: MessageSquare,
  resolved: CheckCircle2,
  escalated: AlertCircle,
};

const statusColors = {
  pending: 'text-yellow-500 bg-yellow-500/10',
  open: 'text-green-500 bg-green-500/10',
  resolved: 'text-blue-500 bg-blue-500/10',
  escalated: 'text-red-500 bg-red-500/10',
};

export function TicketList({ 
  tickets, 
  activeTicketId, 
  onSelectTicket, 
  onNewTicket,
  loading,
  isStaff 
}: TicketListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#075E54] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={saasValaLogo} 
              alt="SaaS Vala" 
              className="h-10 w-10 rounded-full object-cover"
            />
            <div>
              <h2 className="font-semibold">Support</h2>
              <p className="text-xs text-white/70">
                {isStaff ? 'All Tickets' : 'Your Requests'}
              </p>
            </div>
          </div>
          {!isStaff && (
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 text-white hover:bg-white/10"
              onClick={onNewTicket}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No support tickets yet</p>
            {!isStaff && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={onNewTicket}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            )}
          </div>
        ) : (
          tickets.map((ticket) => {
            const StatusIcon = statusIcons[ticket.status];
            const isActive = ticket.id === activeTicketId;

            return (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className={cn(
                  'w-full flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left',
                  isActive && 'bg-[#075E54]/5'
                )}
              >
                <div className="h-12 w-12 rounded-full bg-[#075E54]/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-6 w-6 text-[#075E54]" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-gray-900 truncate">
                      {isStaff ? ticket.user_name : ticket.ticket_number}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {format(new Date(ticket.updated_at), 'MMM d')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 truncate">
                      {ticket.ticket_number}
                    </span>
                    <span className={cn(
                      'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                      statusColors[ticket.status]
                    )}>
                      <StatusIcon className="h-3 w-3" />
                      {ticket.status}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
