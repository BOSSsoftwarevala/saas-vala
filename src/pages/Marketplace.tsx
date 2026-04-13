import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Play, Info } from 'lucide-react';

const Marketplace: React.FC = () => {
  const staticProducts = [
    {
      id: '1',
      name: 'E-commerce Platform',
      description: 'Complete online store solution with payment gateway',
      price: 499,
      category: 'ecommerce',
    },
    {
      id: '2',
      name: 'CRM System',
      description: 'Customer relationship management for businesses',
      price: 399,
      category: 'crm',
    },
    {
      id: '3',
      name: 'ERP Solution',
      description: 'Enterprise resource planning software',
      price: 799,
      category: 'erp',
    },
    {
      id: '4',
      name: 'Project Management',
      description: 'Team collaboration and project tracking tool',
      price: 299,
      category: 'software',
    },
  ];

  const handleDemo = () => {
    alert('Demo coming soon');
  };

  const handleDetails = () => {
    alert('Product details coming soon');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Marketplace</h1>
          <p className="text-gray-400">Discover and purchase premium software solutions</p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {staticProducts.map((product) => (
            <Card key={product.id} className="bg-gray-800 border-gray-700 hover:border-orange-500 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/20">
              <CardContent className="p-4">
                {/* Thumbnail */}
                <div className="w-full h-40 bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-4xl">📦</span>
                </div>

                {/* Name */}
                <h3 className="font-semibold text-lg mb-2">{product.name}</h3>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>

                {/* Price */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-orange-500">
                    ${product.price}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {product.category}
                  </Badge>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
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
                      className="flex-1 border-gray-600 hover:bg-gray-700 text-white"
                      onClick={handleDetails}
                    >
                      <Info className="w-3 h-3 mr-1" />
                      Details
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleDetails}
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Buy Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
