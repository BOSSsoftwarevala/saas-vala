import React, { useState } from 'react';
import { Play, ShoppingCart, Info, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface SimpleSoftwareCardProps {
  software: {
    id: string;
    name: string;
    slug: string;
    tagline: string;
    categories: {
      name: string;
      slug: string;
    };
    icon: string;
    price: number;
    currency: string;
    status: string;
    demo_url: string;
  };
}

export const SimpleSoftwareCard: React.FC<SimpleSoftwareCardProps> = ({ software }) => {
  const [isNotifying, setIsNotifying] = useState(false);
  const [email, setEmail] = useState('');

  const handleDemo = () => {
    window.location.href = `/demo/${software.slug}`;
  };

  const handleDetails = () => {
    window.location.href = `/products/${software.slug}`;
  };

  const handleBuyNow = async () => {
    try {
      toast.loading('Initiating payment...');
      const response = await fetch('/api/v1/marketplace/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: software.id,
          duration_days: 30,
          payment_method: 'wallet',
          amount: software.price,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      toast.dismiss();
      toast.success('Payment successful! License key issued.');
      
      if (data.license_key) {
        toast.success(`Your license key: ${data.license_key}`);
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Payment failed. Please try again.');
    }
  };

  const handleNotifyMe = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsNotifying(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          softwareId: software.id,
          email: email,
        }),
      });

      if (response.ok) {
        toast.success('You will be notified when this software is available!');
        setEmail('');
      } else {
        throw new Error('Failed to submit notification');
      }
    } catch (error) {
      toast.error('Failed to submit notification. Please try again.');
    } finally {
      setIsNotifying(false);
    }
  };

  const isOutOfStock = software.status === 'out_of_stock';

  return (
    <Card className="flex-shrink-0 w-64 bg-gray-900 border-gray-800 hover:border-orange-500 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/20" style={{ scrollSnapAlign: 'start' }}>
      <CardContent className="p-4">
        {/* Icon and Category */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-3xl">{software.icon}</div>
          <Badge variant="secondary" className="text-xs">
            {software.categories.name}
          </Badge>
        </div>

        {/* Software Name */}
        <h3 className="font-semibold text-white mb-2 line-clamp-1">
          {software.name}
        </h3>

        {/* Tagline */}
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {software.tagline}
        </p>

        {/* Price */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xl font-bold text-orange-500">
            ${software.price}
          </span>
          <span className="text-xs text-gray-500">
            {software.currency}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Primary Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleDemo}
            >
              <Play className="w-3 h-3 mr-1" />
              Demo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-gray-700 hover:bg-gray-800 text-white"
              onClick={handleDetails}
            >
              <Info className="w-3 h-3 mr-1" />
              Details
            </Button>
          </div>

          {/* Buy Now / Notify Me */}
          {!isOutOfStock ? (
            <Button
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleBuyNow}
            >
              <ShoppingCart className="w-3 h-3 mr-1" />
              Buy Now - ${software.price}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="text-center text-red-500 text-sm font-medium">
                Out of Stock
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="px-3 border-gray-700 hover:bg-gray-800 text-white"
                  onClick={handleNotifyMe}
                  disabled={isNotifying}
                >
                  <Bell className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
