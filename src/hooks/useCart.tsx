import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface CartItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  price: number;
  category: string;
}

interface CartContextType {
  items: CartItem[];
  count: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  isInCart: (id: string) => boolean;
  toggleItem: (item: CartItem) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = 'sv_cart_items';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    // Keep old sv_cart in sync for backward compat
    localStorage.setItem('sv_cart', JSON.stringify(items.map(i => i.id)));
    window.dispatchEvent(new Event('sv_cart_update'));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => prev.some(i => i.id === item.id) ? prev : [...prev, item]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const isInCart = useCallback((id: string) => items.some(i => i.id === id), [items]);

  const toggleItem = useCallback((item: CartItem) => {
    setItems(prev => prev.some(i => i.id === item.id) ? prev.filter(i => i.id !== item.id) : [...prev, item]);
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.price, 0);

  return (
    <CartContext.Provider value={{ items, count: items.length, addItem, removeItem, isInCart, toggleItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
