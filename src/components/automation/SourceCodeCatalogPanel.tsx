import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSourceCodeCatalog } from '@/hooks/useSourceCodeCatalog';
import { 
  FolderCode, 
  RefreshCw, 
  Search, 
  Upload, 
  Store, 
  Zap,
  Plus,
  GitBranch,
  ShoppingCart,
  BarChart3,
  Loader2,
  Code2,
  FileUp
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export function SourceCodeCatalogPanel() {
  const {
    loading,
    catalog,
    stats,
    addToCatalog,
    bulkAnalyze,
    bulkUploadGitHub,
    listOnMarketplace,
    getStats,
    searchCatalog,
    runFullPipeline,
  } = useSourceCodeCatalog();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [bulkAddText, setBulkAddText] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('SaaSVala');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStats();
    searchCatalog();
  }, [getStats, searchCatalog]);

  // Handle file upload - parse txt file and add projects
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Clean up folder paths - extract just the folder name
      const projects = lines.map(line => {
        // Handle full paths like D:\Projects\MyApp or /home/user/projects/myapp
        const cleanLine = line.trim();
        const pathParts = cleanLine.split(/[\\\/]/);
        const folderName = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || cleanLine;
        
        return {
          project_name: folderName,
          file_path: cleanLine,
          github_account: selectedAccount,
        };
      }).filter(p => p.project_name);

      if (projects.length === 0) {
        toast.error('No valid project names found in file');
        return;
      }

      toast.info(`Processing ${projects.length} projects...`);
      
      // Add in batches of 100
      const batchSize = 100;
      let added = 0;
      
      for (let i = 0; i < projects.length; i += batchSize) {
        const batch = projects.slice(i, i + batchSize);
        await addToCatalog(batch);
        added += batch.length;
        toast.success(`Added ${added}/${projects.length} projects`);
      }

      toast.success(`✅ Successfully added ${projects.length} projects!`);
      await searchCatalog();
      await getStats();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = () => {
    searchCatalog(searchQuery || undefined, filterIndustry || undefined, filterStatus || undefined);
  };

  const handleBulkAdd = async () => {
    if (!bulkAddText.trim()) return;
    
    const lines = bulkAddText.split('\n').filter(line => line.trim());
    const projects = lines.map(line => {
      const parts = line.split('|').map(p => p.trim());
      return {
        project_name: parts[0],
        file_path: parts[1] || undefined,
        file_size: parts[2] ? parseInt(parts[2]) : undefined,
        github_account: selectedAccount,
      };
    });

    await addToCatalog(projects);
    setBulkAddText('');
    setShowAddForm(false);
    await searchCatalog();
    await getStats();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'analyzing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'analyzed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'uploaded': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'listed': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-orange-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <FolderCode className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Source Code Catalog</CardTitle>
                <p className="text-sm text-muted-foreground">
                  1400+ Projects → AI Analyze → GitHub → Marketplace
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { getStats(); searchCatalog(); }}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => runFullPipeline(selectedAccount)}
                disabled={loading}
                className="bg-gradient-to-r from-orange-600 to-red-600"
              >
                <Zap className="h-4 w-4 mr-1" />
                Run Full Pipeline
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FolderCode className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                </div>
                <Code2 className="h-5 w-5 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Analyzed</p>
                  <p className="text-2xl font-bold text-green-400">{stats.analyzed}</p>
                </div>
                <Search className="h-5 w-5 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">On GitHub</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.uploaded_to_github}</p>
                </div>
                <GitBranch className="h-5 w-5 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Marketplace</p>
                  <p className="text-2xl font-bold text-pink-400">{stats.on_marketplace}</p>
                </div>
                <ShoppingCart className="h-5 w-5 text-pink-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.csv"
              className="hidden"
            />
            
            {/* Upload TXT File - Main action */}
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4 mr-1" />
              )}
              📁 Upload TXT File
            </Button>
            
            <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Manually
            </Button>
            <Button onClick={bulkAnalyze} disabled={loading} variant="secondary">
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              AI Analyze All
            </Button>
            <div className="flex gap-2">
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SaaSVala">SaaSVala</SelectItem>
                  <SelectItem value="SoftwareVala">SoftwareVala</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => bulkUploadGitHub(selectedAccount, 20)} disabled={loading}>
                <Upload className="h-4 w-4 mr-1" />
                Upload to GitHub
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Projects Form */}
      {showAddForm && (
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-lg">Add Projects to Catalog</CardTitle>
            <p className="text-sm text-muted-foreground">
              Format: ProjectName | FilePath | FileSize (one per line)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Restaurant Billing System | D:/Projects/restaurant-pos | 15000000
Hotel Booking App | D:/Projects/hotel-app | 25000000
School Management | D:/Projects/school-erp | 45000000"
              value={bulkAddText}
              onChange={(e) => setBulkAddText(e.target.value)}
              rows={8}
            />
            <div className="flex gap-2">
              <Button onClick={handleBulkAdd} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Add {bulkAddText.split('\n').filter(l => l.trim()).length} Projects
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
            <Select value={filterIndustry} onValueChange={setFilterIndustry}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Industries</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="food">Food & Restaurant</SelectItem>
                <SelectItem value="transport">Transport</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="analyzed">Analyzed</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="listed">Listed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Catalog List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Projects ({catalog.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {catalog.length === 0 && !loading && (
                <p className="text-center text-muted-foreground py-8">
                  No projects found. Add some to get started!
                </p>
              )}
              {catalog.map((project) => (
                <div
                  key={project.id}
                  className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Show Vala branded name prominently if available */}
                        {project.vala_name ? (
                          <>
                            <span className="font-bold text-primary">{project.vala_name}</span>
                            <span className="text-xs text-muted-foreground">({project.project_name})</span>
                          </>
                        ) : (
                          <span className="font-medium">{project.project_name}</span>
                        )}
                        <Badge variant="outline" className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                        {project.project_type && (
                          <Badge variant="secondary" className="text-xs">
                            {project.project_type}
                          </Badge>
                        )}
                        {project.target_industry && (
                          <Badge variant="outline" className="text-xs">
                            {project.target_industry}
                          </Badge>
                        )}
                      </div>
                      {project.ai_description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {project.ai_description}
                        </p>
                      )}
                      {project.tech_stack && Object.keys(project.tech_stack).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(project.tech_stack).slice(0, 3).map(([key, values]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {Array.isArray(values) ? values.join(', ') : values}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {project.github_repo_url && (
                        <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm">
                            <GitBranch className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      {project.status === 'analyzed' && !project.uploaded_to_github && (
                        <Button variant="outline" size="sm" disabled={loading}>
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                      {project.uploaded_to_github && !project.is_on_marketplace && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => listOnMarketplace(project.id, 5)}
                          disabled={loading}
                        >
                          <Store className="h-4 w-4" />
                        </Button>
                      )}
                      {project.is_on_marketplace && (
                        <Badge className="bg-green-500/20 text-green-400">
                          ${project.marketplace_price}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
