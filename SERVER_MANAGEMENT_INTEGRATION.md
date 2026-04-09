// Quick Integration Guide - Server Management with Existing Servers Page

// 1. IMPORT THE HOOK IN YOUR SERVER DASHBOARD/PAGE
// ================================================

import { useServerManagement } from '@/hooks/useServerManagement';

// 2. USE THE HOOK IN YOUR COMPONENT
// ==================================

export function ServerDashboard({ serverId }: { serverId: string }) {
  const {
    metrics,                    // Latest CPU, RAM, Disk metrics
    metricsHistory,            // Historical metrics (24h)
    billing,                   // Current billing cycle
    agents,                    // Connected agents
    logs,                      // Recent activity logs
    analysis,                  // Latest AI analysis
    loading,                   // Loading state for AI analysis
    
    // Functions to call
    runAnalysis,               // Trigger AI analysis
    startServer,               // Start server
    stopServer,                // Stop server
    restartServer,             // Restart server
    markBillingPaid,           // Mark billing as paid
    fetchLogs,                 // Fetch logs on demand
  } = useServerManagement(serverId);

  return (
    <div className="space-y-6">
      {/* Real-time Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="CPU Usage"
            value={`${metrics.cpu_percent}%`}
            status={getMetricStatus('cpu', metrics.cpu_percent)}
          />
          <MetricCard
            title="Memory"
            value={`${Math.round((metrics.ram_used_mb / metrics.ram_total_mb) * 100)}%`}
            secondary={`${Math.round(metrics.ram_used_mb)}MB / ${Math.round(metrics.ram_total_mb)}MB`}
            status={getMetricStatus('ram', (metrics.ram_used_mb / metrics.ram_total_mb) * 100)}
          />
          <MetricCard
            title="Disk Space"
            value={`${Math.round((metrics.disk_used_gb / metrics.disk_total_gb) * 100)}%`}
            secondary={`${Math.round(metrics.disk_used_gb)}GB / ${Math.round(metrics.disk_total_gb)}GB`}
            status={getMetricStatus('disk', (metrics.disk_used_gb / metrics.disk_total_gb) * 100)}
          />
          <MetricCard
            title="Uptime"
            value={formatUptime(metrics.uptime_seconds)}
            secondary={`${metrics.request_count} requests`}
          />
        </div>
      )}

      {/* Agent Status */}
      {agents.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-3">Agent Status</h3>
          {agents.map(agent => (
            <div key={agent.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div>
                <p className="font-medium">{agent.agent_name}</p>
                <p className="text-sm text-muted-foreground">{agent.agent_version}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                agent.status === 'online' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {agent.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">AI Server Analysis</h3>
            <button 
              onClick={runAnalysis}
              disabled={loading}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Re-analyze'}
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{analysis.response}</p>
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Recommendations:</p>
              <ul className="space-y-1">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start">
                    <span className="mr-2">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Billing Information */}
      {billing && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-3">Billing & Usage</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base Price (Monthly)</span>
              <span>${billing.base_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t">
              <span>Total Amount</span>
              <span>${billing.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date</span>
              <span>{new Date(billing.due_date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className={`text-sm px-2 py-1 rounded ${
                billing.status === 'paid' ? 'bg-green-100 text-green-800' :
                billing.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {billing.status.toUpperCase()}
              </span>
              {billing.status === 'pending' && (
                <button 
                  onClick={() => markBillingPaid(billing.id)}
                  className="text-sm text-primary hover:underline"
                >
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Server Controls */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-3">Server Controls</h3>
        <div className="flex gap-2">
          <button 
            onClick={startServer}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Start
          </button>
          <button 
            onClick={restartServer}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Restart
          </button>
          <button 
            onClick={stopServer}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Stop
          </button>
        </div>
      </div>

      {/* Activity Logs */}
      {logs.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-3">Recent Activity</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                <span className={`mt-1 w-2 h-2 rounded-full ${
                  log.status === 'success' ? 'bg-green-600' :
                  log.status === 'failed' ? 'bg-red-600' :
                  'bg-yellow-600'
                }`}></span>
                <div className="flex-1">
                  <p className="font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                  {log.message && <p className="text-xs mt-1">{log.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Chart (Optional - requires chart library) */}
      {metricsHistory.length > 0 && (
        <MetricsChart data={metricsHistory} />
      )}
    </div>
  );
}

// 3. HELPER COMPONENTS
// ====================

function MetricCard({ 
  title, 
  value, 
  secondary, 
  status = 'normal' 
}: { 
  title: string
  value: string
  secondary?: string
  status?: 'normal' | 'warning' | 'critical'
}) {
  const bgColor = {
    normal: 'bg-blue-50',
    warning: 'bg-yellow-50',
    critical: 'bg-red-50'
  }[status];

  const textColor = {
    normal: 'text-blue-900',
    warning: 'text-yellow-900',
    critical: 'text-red-900'
  }[status];

  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <p className={`text-sm font-medium ${textColor}`}>{title}</p>
      <p className={`text-2xl font-bold ${textColor} mt-2`}>{value}</p>
      {secondary && (
        <p className={`text-xs ${textColor} mt-1 opacity-75`}>{secondary}</p>
      )}
    </div>
  );
}

function MetricsChart({ data }: { data: any[] }) {
  // Use your preferred chart library (recharts, chart.js, etc.)
  // Example with simple line rendering:
  return (
    <div className="bg-card rounded-lg border p-4">
      <h3 className="font-semibold mb-3">Performance Over Time</h3>
      <div className="h-64 flex items-end gap-1">
        {data.map((metric, i) => (
          <div
            key={i}
            className="flex-1 bg-blue-500 rounded-t opacity-75 hover:opacity-100 transition"
            style={{
              height: `${(metric.cpu_percent / 100) * 100}%`,
              minHeight: '2px'
            }}
            title={`${metric.cpu_percent}% CPU at ${new Date(metric.recorded_at).toLocaleTimeString()}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">CPU Usage Over Last 24 Hours</p>
    </div>
  );
}

// 4. HELPER FUNCTIONS
// ===================

import { getMetricStatus, formatUptime } from '@/config/serverManagementConfig';

function getMetricStatus(metric: string, value: number): 'normal' | 'warning' | 'critical' {
  // Import and use from config
  return getMetricStatus(metric, value);
}

function formatUptime(seconds: number): string {
  // Import and use from config
  return formatUptime(seconds);
}

// 5. CONNECT TO EXISTING SERVERS PAGE
// ====================================

// In src/pages/Servers.tsx, find the ServerListPanel component and modify it:

function ServerListPanel() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  if (selectedServerId) {
    return <ServerDashboard serverId={selectedServerId} />;
  }

  return (
    <div className="space-y-2">
      {/* Server list */}
      {servers.map(server => (
        <div
          key={server.id}
          onClick={() => setSelectedServerId(server.id)}
          className="p-4 border rounded cursor-pointer hover:bg-accent"
        >
          <h3>{server.name}</h3>
          <p className="text-sm text-muted-foreground">{server.status}</p>
        </div>
      ))}
    </div>
  );
}

// That's it! The server management system is now integrated with your app.
// The hook handles all data fetching and state management automatically.
