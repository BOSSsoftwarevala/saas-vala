import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Module Health Score
// Each module: assign score (API ok, UI ok, DB ok)
// If score < threshold: auto repair

interface ModuleHealth {
  moduleName: string
  apiScore: number
  dbScore: number
  overallScore: number
  status: 'healthy' | 'degraded' | 'unhealthy'
  issues: string[]
  lastChecked: string
}

const HEALTH_THRESHOLD = 70
const CRITICAL_THRESHOLD = 50

interface ModuleDefinition {
  name: string
  tables: string[]
  apiEndpoints: string[]
  edgeFunction: string
}

const MODULES: ModuleDefinition[] = [
  {
    name: 'products',
    tables: ['products'],
    apiEndpoints: ['products', 'marketplace', 'marketplace-admin'],
    edgeFunction: 'api-gateway'
  },
  {
    name: 'keys',
    tables: ['license_keys'],
    apiEndpoints: ['keys'],
    edgeFunction: 'api-gateway'
  },
  {
    name: 'wallets',
    tables: ['wallets', 'wallet_transactions'],
    apiEndpoints: ['wallet'],
    edgeFunction: 'api-gateway'
  },
  {
    name: 'deployments',
    tables: ['deployments', 'servers'],
    apiEndpoints: ['deploy', 'server', 'server-management'],
    edgeFunction: 'api-gateway'
  },
  {
    name: 'apk_pipeline',
    tables: ['apk_build_queue'],
    apiEndpoints: ['apk'],
    edgeFunction: 'auto-apk-pipeline'
  },
  {
    name: 'ai_chat',
    tables: ['ai_usage_daily'],
    apiEndpoints: ['ai', 'chat'],
    edgeFunction: 'ai-chat'
  }
]

async function checkModuleDBHealth(admin: any, module: ModuleDefinition): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = []
  let score = 100
  
  for (const table of module.tables) {
    try {
      const { error } = await admin.from(table).select('id').limit(1)
      if (error) {
        issues.push(`Table ${table} error: ${error.message}`)
        score -= 25
      }
    } catch (e) {
      issues.push(`Table ${table} not accessible: ${e.message}`)
      score -= 50
    }
  }
  
  return { score: Math.max(0, score), issues }
}

async function checkModuleAPIHealth(admin: any, module: ModuleDefinition): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = []
  let score = 100

  try {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const { data: errorLogs, error: errorLogsError } = await admin
      .from('error_detection_logs')
      .select('error_type, details, detected_at')
      .gte('detected_at', since)

    if (errorLogsError) {
      issues.push(`Error log lookup failed: ${errorLogsError.message}`)
      score -= 20
    }

    const { data: healAlerts, error: healAlertsError } = await admin
      .from('heal_alerts')
      .select('component, status, details, created_at')
      .gte('created_at', since)

    if (healAlertsError) {
      issues.push(`Heal alert lookup failed: ${healAlertsError.message}`)
      score -= 20
    }

    const relevantErrors = (errorLogs || []).filter((entry: any) => {
      const errorType = String(entry.error_type || '').toLowerCase()
      const details = JSON.stringify(entry.details || {}).toLowerCase()
      return errorType.includes(module.name.toLowerCase()) || details.includes(module.name.toLowerCase())
    })

    const relevantAlerts = (healAlerts || []).filter((entry: any) => {
      const component = String(entry.component || '').toLowerCase()
      const details = String(entry.details || '').toLowerCase()
      return component.includes(module.name.toLowerCase()) || details.includes(module.name.toLowerCase())
    })

    if (relevantErrors.length > 0) {
      issues.push(`Recent API-related errors detected: ${relevantErrors.length}`)
      score -= Math.min(60, relevantErrors.length * 15)
    }

    if (relevantAlerts.length > 0) {
      issues.push(`Recent heal alerts detected: ${relevantAlerts.length}`)
      score -= Math.min(40, relevantAlerts.length * 10)
    }
  } catch (e) {
    issues.push(`API health evaluation failed: ${String(e)}`)
    score -= 50
  }

  return { score: Math.max(0, score), issues }
}

async function calculateModuleHealth(admin: any, module: ModuleDefinition): Promise<ModuleHealth> {
  const dbHealth = await checkModuleDBHealth(admin, module)
  const apiHealth = await checkModuleAPIHealth(admin, module)
  
  const overallScore = Math.round((dbHealth.score + apiHealth.score) / 2)
  const allIssues = [...dbHealth.issues, ...apiHealth.issues]
  
  let status: ModuleHealth['status'] = 'healthy'
  if (overallScore < CRITICAL_THRESHOLD) {
    status = 'unhealthy'
  } else if (overallScore < HEALTH_THRESHOLD) {
    status = 'degraded'
  }
  
  return {
    moduleName: module.name,
    apiScore: apiHealth.score,
    dbScore: dbHealth.score,
    overallScore,
    status,
    issues: allIssues,
    lastChecked: new Date().toISOString()
  }
}

async function attemptModuleRepair(admin: any, health: ModuleHealth): Promise<boolean> {
  if (health.status === 'healthy') return true
  
  let repaired = false
  
  // Log the repair attempt
  await admin.from('module_health_logs').insert({
    module_name: health.moduleName,
    status_before: health.status,
    score_before: health.overallScore,
    issues: health.issues,
    repair_attempted: true,
    created_at: new Date().toISOString()
  })
  
  // For now, we can only log issues for manual intervention
  // Auto-repair would require schema migrations or infrastructure changes
  
  if (health.dbScore < 70) {
    // Cannot auto-fix DB issues without schema
    await admin.from('module_health_issues').insert({
      module_name: health.moduleName,
      issue_type: 'database',
      severity: health.dbScore < CRITICAL_THRESHOLD ? 'critical' : 'warning',
      description: health.issues.filter(i => i.includes('Table')).join('; '),
      requires_manual_intervention: true,
      created_at: new Date().toISOString()
    })
  }
  
  if (health.apiScore < 70) {
    // Cannot auto-fix edge function issues
    await admin.from('module_health_issues').insert({
      module_name: health.moduleName,
      issue_type: 'api',
      severity: health.apiScore < CRITICAL_THRESHOLD ? 'critical' : 'warning',
      description: health.issues.filter(i => i.includes('Edge function')).join('; '),
      requires_manual_intervention: true,
      created_at: new Date().toISOString()
    })
  }
  
  return repaired
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = adminClient()
    const { action, module_name, auto_repair } = await req.json()

    if (action === 'check') {
      const healthResults: ModuleHealth[] = []
      
      if (module_name) {
        const module = MODULES.find(m => m.name === module_name)
        if (module) {
          const health = await calculateModuleHealth(admin, module)
          healthResults.push(health)
        }
      } else {
        // Check all modules
        for (const module of MODULES) {
          const health = await calculateModuleHealth(admin, module)
          healthResults.push(health)
        }
      }
      
      // Store health check results
      await admin.from('module_health_reports').insert({
        module_health: healthResults,
        checked_at: new Date().toISOString()
      })
      
      const unhealthyCount = healthResults.filter(h => h.status === 'unhealthy').length
      const degradedCount = healthResults.filter(h => h.status === 'degraded').length
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Module health check completed',
        data: {
          total: healthResults.length,
          healthy: healthResults.filter(h => h.status === 'healthy').length,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
          modules: healthResults
        }
      }), { headers: corsHeaders })
    }

    if (action === 'repair') {
      if (!module_name) {
        return new Response(JSON.stringify({
          success: false,
          message: 'module_name is required',
          data: null
        }), { status: 400, headers: corsHeaders })
      }
      
      const module = MODULES.find(m => m.name === module_name)
      if (!module) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Module not found',
          data: null
        }), { status: 404, headers: corsHeaders })
      }
      
      const health = await calculateModuleHealth(admin, module)
      let repaired = false
      
      if (auto_repair && health.status !== 'healthy') {
        repaired = await attemptModuleRepair(admin, health)
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: repaired ? 'Module repair attempted' : 'Module health retrieved',
        data: {
          health,
          repaired,
          requires_manual_intervention: !repaired && health.status !== 'healthy'
        }
      }), { headers: corsHeaders })
    }

    if (action === 'get_status') {
      const { data, error } = await admin
        .from('module_health_reports')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(10)
      
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to fetch module health status',
          data: null
        }), { status: 500, headers: corsHeaders })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Module health status retrieved',
        data: data || []
      }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      success: false,
      message: 'Unknown action',
      data: null
    }), { status: 400, headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: `Module health error: ${error.message}`,
      data: null
    }), { status: 500, headers: corsHeaders })
  }
})
