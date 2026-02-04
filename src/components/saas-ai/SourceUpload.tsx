import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileArchive, 
  FolderOpen, 
  FileCode, 
  CheckCircle2, 
  Loader2,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: 'zip' | 'folder' | 'php' | 'js' | 'mixed';
  status: 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  language?: string;
  framework?: string;
}

interface SourceUploadProps {
  onUploadComplete: (file: UploadedFile) => void;
}

export function SourceUpload({ onUploadComplete }: SourceUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const processFile = useCallback((file: File) => {
    const fileType = file.name.endsWith('.zip') ? 'zip' : 
                     file.name.endsWith('.php') ? 'php' :
                     file.name.endsWith('.js') ? 'js' : 'mixed';

    const newFile: UploadedFile = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: fileType,
      status: 'uploading',
      progress: 0,
    };

    setFiles(prev => [...prev, newFile]);

    // Simulate chunked upload with progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Move to processing
        setFiles(prev => prev.map(f => 
          f.id === newFile.id 
            ? { ...f, progress: 100, status: 'processing' } 
            : f
        ));

        // Simulate processing
        setTimeout(() => {
          const detectedLanguage = fileType === 'php' ? 'PHP' : fileType === 'js' ? 'JavaScript' : 'Mixed';
          const detectedFramework = fileType === 'php' ? 'Laravel' : fileType === 'js' ? 'React' : 'Custom';
          
          setFiles(prev => prev.map(f => 
            f.id === newFile.id 
              ? { 
                  ...f, 
                  status: 'ready', 
                  language: detectedLanguage,
                  framework: detectedFramework
                } 
              : f
          ));

          onUploadComplete({
            ...newFile,
            status: 'ready',
            progress: 100,
            language: detectedLanguage,
            framework: detectedFramework
          });

          toast.success('Source code uploaded', {
            description: `${file.name} is ready for analysis`
          });
        }, 2000);
      } else {
        setFiles(prev => prev.map(f => 
          f.id === newFile.id ? { ...f, progress } : f
        ));
      }
    }, 200);
  }, [onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(processFile);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    selectedFiles.forEach(processFile);
  }, [processFile]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'zip': return FileArchive;
      case 'folder': return FolderOpen;
      case 'php': return FileCode;
      case 'js': return FileCode;
      default: return FileText;
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Source Code Upload</CardTitle>
            <CardDescription className="text-xs">
              ZIP • Folder • PHP • JS • Mixed | No Size Limit
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              'h-14 w-14 rounded-2xl flex items-center justify-center transition-colors',
              isDragging ? 'bg-primary/20' : 'bg-muted'
            )}>
              <Upload className={cn(
                'h-7 w-7 transition-colors',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Drop your source code here
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>
            <input
              type="file"
              onChange={handleFileSelect}
              accept=".zip,.php,.js,.jsx,.ts,.tsx,.html,.css"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ position: 'absolute' }}
            />
            <label>
              <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                Browse Files
              </Button>
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".zip,.php,.js,.jsx,.ts,.tsx,.html,.css"
                multiple
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Uploaded Files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Uploaded Files</p>
            {files.map((file) => {
              const TypeIcon = getTypeIcon(file.type);
              
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {formatSize(file.size)}
                      </Badge>
                    </div>
                    
                    {file.status === 'uploading' && (
                      <div className="mt-2">
                        <Progress value={file.progress} className="h-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploading... {Math.round(file.progress)}%
                        </p>
                      </div>
                    )}
                    
                    {file.status === 'processing' && (
                      <div className="flex items-center gap-2 mt-1">
                        <Loader2 className="h-3 w-3 animate-spin text-secondary" />
                        <p className="text-xs text-secondary">
                          Detecting language & framework...
                        </p>
                      </div>
                    )}
                    
                    {file.status === 'ready' && (
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <p className="text-xs text-success">
                          {file.language} • {file.framework}
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
