import { useCart } from '@/hooks/useCart';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Trash2, ArrowLeft, Package, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Cart() {
  const { items, removeItem, clearCart, total, count } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Shopping Cart
            <Badge variant="secondary" className="ml-1">{count}</Badge>
          </h1>
        </div>
        {count > 0 && (
          <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={clearCart}>
            <Trash2 className="h-4 w-4 mr-1" /> Clear All
          </Button>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {count === 0 ? (
          <div className="text-center py-20 space-y-4">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Your cart is empty</h2>
            <p className="text-muted-foreground">Browse the marketplace and add products</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              <Package className="mr-2 h-4 w-4" /> Browse Marketplace
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card"
                >
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <span className="text-lg font-black text-primary">${item.price}</span>
                  <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Summary */}
            <div className="mt-6 p-6 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">{count} item(s)</span>
                <span className="text-2xl font-black text-primary">${total}</span>
              </div>
              <Button
                className="w-full h-12 text-sm font-black gap-2"
                style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
                onClick={() => {
                  // Buy first item and navigate to marketplace checkout
                  if (items[0]) navigate('/?buy=' + items[0].id);
                }}
              >
                <CreditCard className="h-4 w-4" />
                CHECKOUT — ${total}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">Powered by Software Vala™</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
