import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeploymentStage {
  stage: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message: string;
  details?: string;
  timestamp: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  stages: DeploymentStage[];
  analysis: {
    framework: string;
    language: string;
    files: number;
    size: string;
    dependencies: string[];
  };
  fixes: {
    applied: number;
    details: string[];
  };
  security: {
    issues: number;
    fixed: number;
    remaining: string[];
  };
  deployment: {
    status: 'deployed' | 'ready' | 'failed';
    url?: string;
    errors?: string[];
  };
  tests: {
    passed: number;
    failed: number;
    details: string[];
  };
  demoCredentials?: {
    username: string;
    password: string;
    note: string;
  };
}

export interface HostingCredentials {
  type: 'ftp' | 'sftp' | 'cpanel' | 'ssh';
  host: string;
  username: string;
  password: string;
  port?: number;
  path?: string;
  dbHost?: string;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
}

interface UseAutoDeployOptions {
  onStageUpdate?: (stages: DeploymentStage[]) => void;
  onComplete?: (result: DeploymentResult) => void;
}

export function useAutoDeploy({ onStageUpdate, onComplete }: UseAutoDeployOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [stages, setStages] = useState<DeploymentStage[]>([]);
  const [result, setResult] = useState<DeploymentResult | null>(null);
  const [progress, setProgress] = useState(0);

  const updateStages = useCallback((newStages: DeploymentStage[]) => {
    setStages(newStages);
    onStageUpdate?.(newStages);
    
    // Calculate progress based on completed stages
    const totalStages = 7;
    const completedStages = newStages.filter(s => 
      s.status === 'success' || s.status === 'failed' || s.status === 'skipped'
    ).length;
    setProgress(Math.round((completedStages / totalStages) * 100));
    
    // Set current stage
    const runningStage = newStages.find(s => s.status === 'running');
    if (runningStage) {
      setCurrentStage(runningStage.stage);
    }
  }, [onStageUpdate]);

  const uploadAndDeploy = useCallback(async (
    file: File,
    hostingCredentials?: HostingCredentials
  ): Promise<DeploymentResult | null> => {
    setIsProcessing(true);
    setProgress(0);
    setStages([]);
    setResult(null);

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to deploy');
        setIsProcessing(false);
        return null;
      }

      // Initial stage
      const initialStages: DeploymentStage[] = [
        { stage: 'upload', status: 'running', message: 'Uploading file...', timestamp: new Date().toISOString() }
      ];
      updateStages(initialStages);

      // Upload file to storage
      const fileId = crypto.randomUUID();
      const filePath = `${user.id}/${fileId}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('source-code')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        const failedStages: DeploymentStage[] = [
          { stage: 'upload', status: 'failed', message: 'Upload failed', details: uploadError.message, timestamp: new Date().toISOString() }
        ];
        updateStages(failedStages);
        toast.error(`Upload failed: ${uploadError.message}`);
        setIsProcessing(false);
        return null;
      }

      // Update upload success
      updateStages([
        { stage: 'upload', status: 'success', message: `Uploaded ${(file.size / 1024 / 1024).toFixed(2)} MB`, timestamp: new Date().toISOString() },
        { stage: 'pipeline', status: 'running', message: 'Starting auto-deploy pipeline...', timestamp: new Date().toISOString() }
      ]);

      toast.success('File uploaded, starting pipeline...');

      // Call the auto-deploy pipeline
      const { data, error } = await supabase.functions.invoke('auto-deploy-pipeline', {
        body: {
          filePath,
          hostingCredentials,
          deploymentId: fileId,
        }
      });

      if (error) {
        console.error('Pipeline error:', error);
        toast.error('Pipeline failed');
        setIsProcessing(false);
        return null;
      }

      const pipelineResult = data as DeploymentResult;
      
      // Update with final stages
      updateStages([
        { stage: 'upload', status: 'success', message: `Uploaded ${(file.size / 1024 / 1024).toFixed(2)} MB`, timestamp: new Date().toISOString() },
        ...pipelineResult.stages
      ]);

      setResult(pipelineResult);
      setProgress(100);
      onComplete?.(pipelineResult);

      if (pipelineResult.success) {
        toast.success('Deployment complete!');
      } else {
        toast.error('Deployment completed with issues');
      }

      return pipelineResult;

    } catch (error: any) {
      console.error('Deploy error:', error);
      toast.error(`Deploy failed: ${error.message}`);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [updateStages, onComplete]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setCurrentStage('');
    setStages([]);
    setResult(null);
    setProgress(0);
  }, []);

  return {
    isProcessing,
    currentStage,
    stages,
    result,
    progress,
    uploadAndDeploy,
    reset,
  };
}
