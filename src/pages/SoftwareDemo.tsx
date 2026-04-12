import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Download, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Software {
  id: string;
  name: string;
  slug: string;
  description: string;
  tagline: string;
  icon: string;
  price: number;
  currency: string;
  demo_url: string;
  category: string;
}

const SoftwareDemo: React.FC = () => {
  const { softwareSlug } = useParams<{ softwareSlug: string }>();
  const navigate = useNavigate();
  const [software, setSoftware] = useState<Software | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSoftware = async () => {
      if (!softwareSlug) return;

      try {
        const response = await fetch(`/api/softwares?slug=${softwareSlug}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Software not found');
        }
        
        if (data.softwares && data.softwares.length > 0) {
          setSoftware(data.softwares[0]);
        } else {
          throw new Error('Software not found');
        }
      } catch (error) {
        console.error('Error fetching software:', error);
        setError('Software not found');
        toast.error('Software not found');
      } finally {
        setLoading(false);
      }
    };

    fetchSoftware();
  }, [softwareSlug]);

  const handleBuyNow = () => {
    toast.success(`Redirecting to purchase ${software?.name} for $${software?.price}`);
    // TODO: Implement payment flow
  };

  const handleDownload = () => {
    toast.success(`Downloading ${software?.name}`);
    // TODO: Implement download flow
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p>Loading demo...</p>
        </div>
      </div>
    );
  }

  if (error || !software) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Software Not Found</h1>
          <p className="text-gray-400 mb-4">{error || 'The requested software demo is not available.'}</p>
          <Button onClick={() => navigate('/marketplace')} className="bg-orange-600 hover:bg-orange-700">
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900 to-black py-6 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/marketplace')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </div>
      </div>

      {/* Software Info */}
      <div className="max-w-7xl mx-auto py-8 px-4 md:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl">{software.icon}</div>
            <div>
              <h1 className="text-3xl font-bold mb-2">{software.name}</h1>
              <p className="text-gray-400">{software.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mb-6">
            <Badge variant="secondary">{software.category}</Badge>
            <span className="text-2xl font-bold text-orange-500">
              ${software.price}
            </span>
          </div>
          <div className="flex gap-4">
            <Button
              size="lg"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleBuyNow}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Buy Now - ${software.price}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-gray-700 hover:bg-gray-800"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Trial
            </Button>
          </div>
        </div>

        {/* Demo Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Demo Area */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-orange-500" />
                  Live Demo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-800 rounded-lg p-8 min-h-[500px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">{software.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{software.name} Demo</h3>
                    <p className="text-gray-400 mb-6">
                      This is a demo preview of {software.name}. The full version includes all features and capabilities.
                    </p>
                    <div className="space-y-4">
                      <div className="bg-gray-700 rounded p-4 text-left">
                        <h4 className="font-semibold mb-2">Key Features:</h4>
                        <ul className="text-sm text-gray-300 space-y-1">
                          <li>• User-friendly interface</li>
                          <li>• Real-time data synchronization</li>
                          <li>• Advanced reporting and analytics</li>
                          <li>• Mobile responsive design</li>
                          <li>• Secure data encryption</li>
                        </ul>
                      </div>
                      <Button className="bg-orange-600 hover:bg-orange-700">
                        Start Interactive Demo
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Description */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  {software.description || 'Professional software solution designed to streamline your business operations and increase productivity.'}
                </p>
              </CardContent>
            </Card>

            {/* System Requirements */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>System Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li>• Windows 10/11 or macOS 10.14+</li>
                  <li>• 4GB RAM minimum (8GB recommended)</li>
                  <li>• 2GB available disk space</li>
                  <li>• Internet connection for activation</li>
                  <li>• Modern web browser (for web version)</li>
                </ul>
              </CardContent>
            </Card>

            {/* Support */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  Get help with installation, setup, and usage.
                </p>
                <Button variant="outline" className="w-full border-gray-700 hover:bg-gray-800">
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoftwareDemo;
