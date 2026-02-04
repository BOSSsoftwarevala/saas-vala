import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';

interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTicket: (userName: string, userEmail: string) => Promise<unknown>;
}

export function NewTicketModal({ open, onOpenChange, onCreateTicket }: NewTicketModalProps) {
  const { user } = useAuth();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    setIsLoading(true);
    const ticket = await onCreateTicket(userName.trim(), userEmail.trim());
    setIsLoading(false);

    if (ticket) {
      setUserName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Support Request</DialogTitle>
          <DialogDescription>
            Please provide your details to start a support conversation. Your information will be used to identify you in this chat.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userName">Your Name</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="userEmail">Your Email</Label>
            <Input
              id="userEmail"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
            <p className="text-xs text-muted-foreground">
              We'll use this to identify your ticket. Don't share it in the chat.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !userName.trim() || !userEmail.trim()}
              className="bg-[#075E54] hover:bg-[#054C44]"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
