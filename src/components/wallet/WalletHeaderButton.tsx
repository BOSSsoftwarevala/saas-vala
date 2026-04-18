import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wallet, Plus, TrendingUp, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { AddCreditsModal } from './AddCreditsModal';

export function WalletHeaderButton() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showAddCredits, setShowAddCredits] = useState(false);

  const fetchBalance = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    setBalance(data?.balance || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchBalance();
    
    // Subscribe to wallet changes
    const channel = supabase
      .channel('wallet-balance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets' },
        () => fetchBalance()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isLowBalance = balance < 500;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative gap-2 text-muted-foreground hover:text-foreground"
          >
            <Wallet className="h-5 w-5" />
            <span className="hidden sm:inline font-semibold">
              {loading ? '...' : `₹${balance.toLocaleString()}`}
            </span>
            {isLowBalance && !loading && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning animate-pulse" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 bg-popover border-border" align="end">
          <DropdownMenuLabel>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-normal">Wallet Balance</span>
              {isLowBalance && (
                <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                  Low Balance
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              ₹{balance.toLocaleString()}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem 
            className="cursor-pointer gap-2"
            onClick={() => setShowAddCredits(true)}
          >
            <Plus className="h-4 w-4 text-success" />
            <span>Add Credits</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="cursor-pointer gap-2"
            onClick={() => navigate('/wallet')}
          >
            <TrendingUp className="h-4 w-4" />
            <span>View Transactions</span>
          </DropdownMenuItem>
          {isLowBalance && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem className="gap-2 text-warning cursor-default">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs">Add credits to avoid service interruption</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AddCreditsModal 
        open={showAddCredits} 
        onOpenChange={setShowAddCredits}
        onSuccess={fetchBalance}
      />
    </>
  );
}
