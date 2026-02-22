import { motion } from 'framer-motion';
import { 
  Server, 
  Database, 
  Code, 
  Rocket, 
  Key, 
  Shield, 
  Terminal,
  GitBranch,
  HardDrive,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ToolResultCardProps {
  toolName: string;
  result: any;
  className?: string;
}

const toolIcons: Record<string, React.ElementType> = {
  analyze_code: Code,
  fix_code: Shield,
  list_servers: Server,
  server_status: Server,
  deploy_project: Rocket,
  database_query: Database,
  generate_license: Key,
  view_logs: Terminal,
  restart_service: RefreshCw,
  git_operations: GitBranch,
  check_ssl: Shield,
  create_backup: HardDrive,
  upload_to_github: GitBranch,
  list_github_repos: GitBranch,
  analyze_zip_file: FileText,
  add_to_source_catalog: Database,
  handle_client_request: FileText,
  send_client_response: FileText,
  check_github_repos: GitBranch,
  test_repo_product: Shield,
  get_client_requests: FileText,
  setup_vala_agent: Terminal,
  setup_whatsapp_integration: FileText,
};

const toolLabels: Record<string, string> = {
  analyze_code: 'Code Analysis',
  fix_code: 'Code Fix Applied',
  list_servers: 'Server List',
  server_status: 'Server Status',
  deploy_project: 'Deployment',
  database_query: 'Database Query',
  generate_license: 'License Generated',
  view_logs: 'Log Output',
  restart_service: 'Service Restart',
  git_operations: 'Git Operation',
  check_ssl: 'SSL Check',
  create_backup: 'Backup Created',
  upload_to_github: 'GitHub Upload',
  list_github_repos: 'GitHub Repos',
  analyze_zip_file: 'ZIP Analysis',
  add_to_source_catalog: 'Source Catalog',
  handle_client_request: 'Client Request',
  send_client_response: 'Client Response',
  check_github_repos: 'GitHub Audit',
  test_repo_product: 'Product Test',
  get_client_requests: 'Client Requests',
  setup_vala_agent: 'VALA Agent Setup',
  setup_whatsapp_integration: 'WhatsApp Setup',
};

export function ToolResultCard({ toolName, result, className }: ToolResultCardProps) {
  const Icon = toolIcons[toolName] || FileText;
  const label = toolLabels[toolName] || toolName;
  const success = result?.success !== false;

  const renderContent = () => {
    switch (toolName) {
      case 'analyze_code':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Language: <span className="font-medium text-foreground">{result.language}</span>
              </span>
              <Badge variant={result.score >= 80 ? 'default' : result.score >= 50 ? 'secondary' : 'destructive'}>
                Score: {result.score}/100
              </Badge>
            </div>
            {result.issues?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Issues Found ({result.issues_found}):</p>
                {result.issues.slice(0, 5).map((issue: any, i: number) => (
                  <div key={i} className={cn(
                    "p-2 rounded-md text-xs",
                    issue.severity === 'critical' && "bg-destructive/10 border border-destructive/30",
                    issue.severity === 'high' && "bg-orange-500/10 border border-orange-500/30",
                    issue.severity === 'medium' && "bg-yellow-500/10 border border-yellow-500/30",
                    issue.severity === 'low' && "bg-muted border border-border"
                  )}>
                    <div className="flex items-center gap-2">
                      {issue.severity === 'critical' && <XCircle className="h-3 w-3 text-destructive" />}
                      {issue.severity === 'high' && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                      {issue.severity === 'medium' && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                      {issue.severity === 'low' && <CheckCircle2 className="h-3 w-3 text-muted-foreground" />}
                      <span className="font-medium">{issue.type.toUpperCase()}</span>
                    </div>
                    <p className="mt-1">{issue.message}</p>
                    {issue.fix && <p className="mt-1 text-primary">💡 {issue.fix}</p>}
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm font-medium">{result.summary}</p>
          </div>
        );

      case 'list_servers':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total: {result.total} servers</p>
            <div className="grid gap-2">
              {result.servers?.slice(0, 5).map((server: any) => (
                <div key={server.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{server.name}</span>
                  </div>
                  <Badge variant={server.status === 'live' ? 'default' : 'secondary'}>
                    {server.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        );

      case 'server_status':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{result.server_name}</span>
              <Badge variant={result.status === 'live' ? 'default' : 'secondary'}>{result.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-muted-foreground">CPU</p>
                <p className="font-medium">{result.metrics?.cpu_usage}</p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-muted-foreground">Memory</p>
                <p className="font-medium">{result.metrics?.memory_usage}</p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-muted-foreground">Disk</p>
                <p className="font-medium">{result.metrics?.disk_usage}</p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-muted-foreground">Uptime</p>
                <p className="font-medium">{result.uptime}</p>
              </div>
            </div>
            {result.services && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Services:</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(result.services).map(([name, status]) => (
                    <Badge key={name} variant={(status as string) === 'running' ? 'default' : 'destructive'} className="text-xs">
                      {name}: {status as string}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'deploy_project':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="font-medium">
                {success ? 'Deployment Successful!' : 'Deployment Failed'}
              </span>
            </div>
            {success && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/50 rounded">
                    <p className="text-muted-foreground">Project</p>
                    <p className="font-medium">{result.project}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <p className="text-muted-foreground">Server</p>
                    <p className="font-medium">{result.server}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-medium">{result.branch}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <p className="text-muted-foreground">Time</p>
                    <p className="font-medium">{result.total_time}</p>
                  </div>
                </div>
                {result.deployed_url && (
                  <a 
                    href={result.deployed_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    🔗 {result.deployed_url}
                  </a>
                )}
              </>
            )}
          </div>
        );

      case 'generate_license':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <span className="font-medium">License Generated</span>
            </div>
            <div className="p-3 bg-muted rounded-md font-mono text-center text-lg tracking-wider">
              {result.license_key}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">{result.key_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expires</p>
                <p className="font-medium">{new Date(result.expires_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        );

      case 'database_query':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Table: {result.table}</span>
              <Badge>{result.operation}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {result.total_count} total, {result.returned_rows} returned
            </p>
            {result.data && result.data.length > 0 && (
              <div className="max-h-40 overflow-auto text-xs">
                <pre className="p-2 bg-muted rounded-md">
                  {JSON.stringify(result.data.slice(0, 3), null, 2)}
                </pre>
              </div>
            )}
          </div>
        );

      case 'view_logs':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {result.log_type} logs ({result.lines_returned} lines)
            </p>
            <div className="max-h-40 overflow-auto bg-black rounded-md p-2">
              {result.logs?.map((log: any) => (
                <div key={log.line} className="font-mono text-xs text-green-400">
                  {log.content}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border rounded-lg p-4 bg-card/50 backdrop-blur-sm",
        success ? "border-primary/30" : "border-destructive/30",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          "p-1.5 rounded-md",
          success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm">{label}</span>
        {success ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive ml-auto" />
        )}
      </div>
      {renderContent()}
    </motion.div>
  );
}
