import { useState } from 'react';
import { CheckCircle2, AlertTriangle, MessageSquarePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SupportTicket } from '@/hooks/useSupportChat';

interface StaffControlsProps {
  ticket: SupportTicket;
  onUpdateStatus: (status: SupportTicket['status']) => Promise<boolean>;
  onSendInternalNote: (content: string) => Promise<boolean>;
}

export function StaffControls({ ticket, onUpdateStatus, onSendInternalNote }: StaffControlsProps) {
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (status: SupportTicket['status']) => {
    setIsLoading(true);
    await onUpdateStatus(status);
    setIsLoading(false);
  };

  const handleSendNote = async () => {
    if (!noteContent.trim()) return;
    
    setIsLoading(true);
    const success = await onSendInternalNote(noteContent.trim());
    if (success) {
      setNoteContent('');
      setShowNoteDialog(false);
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="bg-[#128C7E] px-4 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-white/70 mr-2">Staff Actions:</span>
        
        {/* Approve button (for pending tickets) */}
        {ticket.status === 'pending' && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs bg-green-500 hover:bg-green-600 text-white"
            onClick={() => handleStatusChange('open')}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Approve
          </Button>
        )}

        {/* Status dropdown */}
        {ticket.status !== 'pending' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                disabled={isLoading}
              >
                Update Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleStatusChange('open')}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('resolved')}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-blue-500" />
                Mark Resolved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('escalated')}>
                <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                Escalate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Internal note button */}
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => setShowNoteDialog(true)}
        >
          <MessageSquarePlus className="h-3 w-3 mr-1" />
          Internal Note
        </Button>
      </div>

      {/* Internal note dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Internal Note</DialogTitle>
            <DialogDescription>
              This note will only be visible to staff members, not the user.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Type your internal note..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendNote} 
              disabled={!noteContent.trim() || isLoading}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
