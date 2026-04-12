import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, XCircle, Loader2, ShieldAlert, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ApprovalAction {
  id: string;
  type: 'APPROVE' | 'ALLOW' | 'DENY';
  label: string;
  risk: 'critical' | 'high' | 'medium';
  description: string;
  payload?: any;
}

export interface CriticalActionData {
  reason: string;
  what_to_do: string;
  action_type: 'otp' | 'payment' | 'delete' | 'production_deploy' | 'legal' | 'custom';
  risk_level: 'critical' | 'high' | 'medium';
  actions: ApprovalAction[];
  context?: string;
}

interface CriticalApprovalBoxProps {
  data: CriticalActionData;
  onApprove: (actionId: string, payload?: any) => void;
  onDeny: (actionId: string) => void;
  messageId: string;
}

const riskConfig = {
  critical: {
    border: 'border-destructive/60',
    bg: 'bg-destructive/10',
    badge: 'bg-destructive/20 text-destructive border border-destructive/30',
    icon: <ShieldAlert className="h-5 w-5 text-destructive" />,
    label: '🔴 CRITICAL'
  },
  high: {
    border: 'border-warning/60',
    bg: 'bg-warning/10',
    badge: 'bg-warning/20 text-warning border border-warning/30',
    icon: <AlertTriangle className="h-5 w-5 text-warning" />,
    label: '🟠 HIGH RISK'
  },
  medium: {
    border: 'border-primary/40',
    bg: 'bg-primary/5',
    badge: 'bg-primary/10 text-primary border border-primary/20',
    icon: <Zap className="h-5 w-5 text-primary" />,
    label: '🟡 CONFIRM REQUIRED'
  }
};

export function CriticalApprovalBox({ data, onApprove, onDeny, messageId: _messageId }: CriticalApprovalBoxProps) {
  const [executedAction, setExecutedAction] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  const config = riskConfig[data.risk_level];

  const handleAction = async (action: ApprovalAction) => {
    if (executedAction) return;
    setIsExecuting(action.id);
    
    await new Promise(r => setTimeout(r, 600)); // Brief delay for UX
    
    if (action.type === 'DENY') {
      onDeny(action.id);
    } else {
      onApprove(action.id, action.payload);
    }
    
    setExecutedAction(action.id);
    setIsExecuting(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`my-4 rounded-2xl border-2 ${config.border} ${config.bg} overflow-hidden shadow-lg`}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3">
        {config.icon}
        <span className="font-bold text-foreground text-sm tracking-wide">⚠️ ACTION REQUIRED</span>
        <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${config.badge}`}>
          {config.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Reason</p>
          <p className="text-sm text-foreground font-medium">{data.reason}</p>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">What to do</p>
          <p className="text-sm text-foreground/90">{data.what_to_do}</p>
        </div>

        {data.context && (
          <div className="p-3 rounded-xl bg-background/40 border border-white/5">
            <p className="text-xs text-muted-foreground font-mono">{data.context}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-5 py-4 border-t border-white/5 flex flex-wrap gap-3">
        <AnimatePresence>
          {!executedAction ? (
            data.actions.map((action) => (
              <motion.div key={action.id} layout>
                <Button
                  onClick={() => handleAction(action)}
                  disabled={!!isExecuting}
                  variant={action.type === 'DENY' ? 'outline' : 'default'}
                  className={
                    action.type === 'DENY'
                      ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
                      : action.risk === 'critical'
                      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg'
                      : action.risk === 'high'
                      ? 'bg-warning hover:bg-warning/90 text-warning-foreground font-bold'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground font-bold'
                  }
                  size="sm"
                >
                  {isExecuting === action.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      {action.type === 'APPROVE' && <CheckCircle className="h-4 w-4 mr-2" />}
                      {action.type === 'ALLOW' && <Zap className="h-4 w-4 mr-2" />}
                      {action.type === 'DENY' && <XCircle className="h-4 w-4 mr-2" />}
                      {action.label}
                    </>
                  )}
                </Button>
              </motion.div>
            ))
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-sm text-primary"
            >
              <CheckCircle className="h-4 w-4" />
              {executedAction && data.actions.find(a => a.id === executedAction)?.type === 'DENY'
                ? '❌ Action cancelled'
                : '✅ Action approved — executing...'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Parse AI response text to detect if it contains a critical action block
export function parseCriticalAction(content: string): CriticalActionData | null {
  // Look for the structured ACTION REQUIRED block
  const actionMatch = content.match(/⚠️\s*ACTION REQUIRED[\s\S]*?(?=\n\n|\n---|\n#|$)/i);
  if (!actionMatch) return null;

  const block = actionMatch[0];
  
  // Extract reason
  const reasonMatch = block.match(/Reason:\s*(.+)/i);
  const whatMatch = block.match(/What to do:\s*(.+)/i);
  
  if (!reasonMatch || !whatMatch) return null;

  const reason = reasonMatch[1].trim();
  const what_to_do = whatMatch[1].trim();

  // Determine risk level from content
  let risk_level: 'critical' | 'high' | 'medium' = 'high';
  let action_type: CriticalActionData['action_type'] = 'custom';
  
  const lowerBlock = block.toLowerCase();
  if (lowerBlock.includes('payment') || lowerBlock.includes('pay')) {
    risk_level = 'critical';
    action_type = 'payment';
  } else if (lowerBlock.includes('delete') || lowerBlock.includes('destroy') || lowerBlock.includes('drop')) {
    risk_level = 'critical';
    action_type = 'delete';
  } else if (lowerBlock.includes('production') || lowerBlock.includes('live deploy')) {
    risk_level = 'critical';
    action_type = 'production_deploy';
  } else if (lowerBlock.includes('otp') || lowerBlock.includes('verify')) {
    risk_level = 'high';
    action_type = 'otp';
  } else if (lowerBlock.includes('legal') || lowerBlock.includes('terms')) {
    risk_level = 'high';
    action_type = 'legal';
  } else {
    risk_level = 'medium';
  }

  // Build actions
  const actions: ApprovalAction[] = [];
  
  if (block.includes('APPROVE') || block.includes('ALLOW')) {
    actions.push({
      id: 'approve-' + Date.now(),
      type: 'APPROVE',
      label: block.includes('ENTER OTP') ? 'Enter OTP & Continue' : 'APPROVE & CONTINUE',
      risk: risk_level,
      description: what_to_do,
    });
  }
  
  if (block.includes('ALLOW')) {
    actions.push({
      id: 'allow-' + Date.now(),
      type: 'ALLOW',
      label: 'ALLOW',
      risk: 'medium',
      description: what_to_do,
    });
  }

  // Always add deny
  actions.push({
    id: 'deny-' + Date.now(),
    type: 'DENY',
    label: 'CANCEL',
    risk: 'medium',
    description: 'Cancel this action',
  });

  return {
    reason,
    what_to_do,
    action_type,
    risk_level,
    actions,
  };
}
