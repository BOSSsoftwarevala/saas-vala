// Boss APK Pipeline Module - APK upload and deployment management
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload,
  Package,
  Download,
  MoreVertical,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  FileText,
  HardDrive,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface APK {
  id: string;
  product_id: string;
  version: string;
  file_url: string;
  file_size: number;
  checksum: string;
  is_active: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  name: string;
  status: string;
}

interface Deployment {
  id: string;
  server_id: string;
  version: string;
  status: 'pending' | 'deploying' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  logs: string;
  created_by: string;
}

export default function BossAPKPipelines() {
  const [apks, setApks] = useState<APK[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apksData, productsData, deploymentsData] = await Promise.all([
        fetchAPKs(),
        fetchProducts(),
        fetchDeployments(),
      ]);

      setApks(apksData);
      setProducts(productsData);
      setDeployments(deploymentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAPKs = async (): Promise<APK[]> => {
    const { data, error } = await supabase
      .from('apks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as APK[]) || [];
  };

  const fetchProducts = async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, status')
      .eq('status', 'active');

    if (error) throw error;
    return (data as Product[]) || [];
  };

  const fetchDeployments = async (): Promise<Deployment[]> => {
    const { data, error } = await supabase
      .from('server_deployments')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data as Deployment[]) || [];
  };

  const handleUpload = async (file: File) => {
    if (!selectedProduct) {
      toast.error('Please select a product first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(i);
      }

      const { data, error } = await supabase
        .from('apks')
        .insert({
          product_id: selectedProduct,
          version: `v${Date.now()}`,
          file_url: file.name,
          file_size: file.size,
          checksum: 'generated-checksum',
          is_active: false,
          download_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('APK uploaded successfully');
      setShowUploadModal(false);
      loadData();
    } catch (error) {
      console.error('Error uploading APK:', error);
      toast.error('Failed to upload APK');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('apks')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setApks(prev =>
        prev.map(apk =>
          apk.id === id ? { ...apk, is_active: isActive } : apk
        )
      );
      toast.success(isActive ? 'APK activated' : 'APK deactivated');
    } catch (error) {
      console.error('Error toggling APK:', error);
      toast.error('Failed to update APK');
    }
  };

  const deleteAPK = async (id: string) => {
    try {
      const { error } = await supabase
        .from('apks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setApks(prev => prev.filter(apk => apk.id !== id));
      toast.success('APK deleted');
    } catch (error) {
      console.error('Error deleting APK:', error);
      toast.error('Failed to delete APK');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'failed':
      case 'inactive':
        return 'text-red-500 bg-red-500/10';
      case 'deploying':
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredAPKs = apks.filter(apk =>
    apk.version.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDownloads = apks.reduce((sum, apk) => sum + apk.download_count, 0);
  const totalStorage = apks.reduce((sum, apk) => sum + apk.file_size, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">APK Pipeline</h1>
          <p className="text-slate-400">Upload, manage, and deploy APK files</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Upload className="w-5 h-5" />
          Upload APK
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Package className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{apks.length}</h3>
          <p className="text-sm text-slate-400">APK Files</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <HardDrive className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-slate-400">Storage</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{formatFileSize(totalStorage)}</h3>
          <p className="text-sm text-slate-400">Total Size</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Download className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{totalDownloads.toLocaleString()}</h3>
          <p className="text-sm text-slate-400">Downloads</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Active</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{apks.filter(a => a.is_active).length}</h3>
          <p className="text-sm text-slate-400">Active APKs</p>
        </div>
      </div>

      {/* APK List */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">APK Files</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search APKs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <Filter className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {filteredAPKs.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No APKs uploaded yet</h3>
            <p className="text-slate-400 mb-4">Upload your first APK file to get started</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Upload className="w-4 h-4" />
              Upload APK
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAPKs.map((apk) => {
              const product = products.find(p => p.id === apk.product_id);
              return (
                <div
                  key={apk.id}
                  className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn('p-3 rounded-xl', apk.is_active ? 'bg-green-500/20' : 'bg-slate-700/50')}>
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">{apk.version}</h3>
                          <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(apk.is_active ? 'active' : 'inactive'))}>
                            {apk.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{product?.name || 'Unknown Product'}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Size: {formatFileSize(apk.file_size)}</span>
                          <span>Downloads: {apk.download_count}</span>
                          <span>Checksum: {apk.checksum.slice(0, 12)}...</span>
                          <span>{new Date(apk.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(apk.id, !apk.is_active)}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          apk.is_active
                            ? 'hover:bg-red-500/20 text-green-500 hover:text-red-500'
                            : 'hover:bg-green-500/20 text-slate-400 hover:text-green-500'
                        )}
                      >
                        {apk.is_active ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                      </button>
                      <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                        <Download className="w-5 h-5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => deleteAPK(apk.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                        <MoreVertical className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Deployments */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Deployments</h2>
          <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            View All
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>

        {deployments.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No deployments yet</h3>
            <p className="text-slate-400">Deployment history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={cn('p-2 rounded-lg', getStatusColor(deployment.status))}>
                    {deployment.status === 'success' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : deployment.status === 'failed' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{deployment.version}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', getStatusColor(deployment.status))}>
                        {deployment.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>Server: {deployment.server_id}</span>
                      <span>Started: {new Date(deployment.started_at).toLocaleString()}</span>
                      {deployment.completed_at && (
                        <span>Completed: {new Date(deployment.completed_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                {deployment.status === 'failed' && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Check logs for details</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">Upload APK</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Choose a product...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">APK File</label>
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-blue-500/50 transition-colors">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Drag and drop or click to upload</p>
                  <p className="text-xs text-slate-500 mt-1">APK files only</p>
                  <input
                    type="file"
                    accept=".apk"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                    className="hidden"
                    id="apk-upload"
                  />
                  <label
                    htmlFor="apk-upload"
                    className="inline-block mt-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    Select File
                  </label>
                </div>
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Uploading...</span>
                    <span className="text-white">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
