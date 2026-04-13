import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', user?.id);
      
      if (error) throw error;
      setFavorites(data?.map(f => f.product_id) || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const toggleFavorite = async (productId: string) => {
    if (!user) return false;
    
    try {
      if (favorites.includes(productId)) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
        
        if (error) throw error;
        setFavorites(prev => prev.filter(id => id !== productId));
        return false;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, product_id: productId });
        
        if (error) throw error;
        setFavorites(prev => [...prev, productId]);
        return true;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  };

  const isFavorited = (productId: string) => {
    return favorites.includes(productId);
  };

  return { favorites, toggleFavorite, isFavorited, fetchFavorites };
}
