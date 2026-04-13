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

// Global Monitor Engine
// Tracks API status, DB queries, server health, module status
// Runs on demand via cron or manual trigger

interface HealthCheckResult {
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  message: string
  timestamp: string
}

async function checkDatabaseHealth(admin: any): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const { error } = await admin.from('profiles').select('id').limit(1)
    const latency = Date.now() - start
    
    if (error) {
      return {
        component: 'database',
        status: 'unhealthy',
        latency,
        message: `Database error: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }
    
    return {
      component: 'database',
      status: latency > 1000 ? 'degraded' : 'healthy',
      latency,
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    }
  } catch (e) {
    return {
      component: 'database',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: `Database check failed: ${e.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function checkStorageHealth(admin: any): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const { data, error } = await admin.storage.listBuckets()
    const latency = Date.now() - start
    
    if (error) {
      return {
        component: 'storage',
        status: 'unhealthy',
        latency,
        message: `Storage error: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }
    
    return {
      component: 'storage',
      status: latency > 1000 ? 'degraded' : 'healthy',
      latency,
      message: `Storage accessible (${data.length} buckets)`,
      timestamp: new Date().toISOString()
    }
  } catch (e) {
    return {
      component: 'storage',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: `Storage check failed: ${e.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function checkEdgeFunctionHealth(admin: any, functionName: string): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const { data, error } = await admin.functions.invoke(functionName, { body: { health_check: true } })
    const latency = Date.now() - start
    
    if (error) {
      return {
        component: `edge_function_${functionName}`,
        status: 'unhealthy',
        latency,
        message: `Edge function error: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }
    
    return {
      component: `edge_function_${functionName}`,
      status: latency > 2000 ? 'degraded' : 'healthy',
      latency,
      message: 'Edge function responsive',
      timestamp: new Date().toISOString()
    }
  } catch (e) {
    return {
      component: `edge_function_${functionName}`,
      status: 'unhealthy',
      latency: Date.now() - start,
      message: `Edge function check failed: ${e.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function checkModuleHealth(admin: any, moduleName: string): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    let query
    switch (moduleName) {
      case 'products':
        query = admin.from('products').select('id').limit(1)
        break
      case 'keys':
        query = admin.from('license_keys').select('id').limit(1)
        break
      case 'wallets':
        query = admin.from('wallets').select('id').limit(1)
        break
      case 'deployments':
        query = admin.from('deployments').select('id').limit(1)
        break
      default:
        return {
          component: `module_${moduleName}`,
          status: 'healthy',
          latency: 0,
          message: 'Module not checked',
          timestamp: new Date().toISOString()
        }
    }
    
    const { error } = await query
    const latency = Date.now() - start
    
    if (error) {
      return {
        component: `module_${moduleName}`,
        status: 'unhealthy',
        latency,
        message: `Module error: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    }
    
    return {
      component: `module_${moduleName}`,
      status: latency > 1000 ? 'degraded' : 'healthy',
      latency,
      message: 'Module accessible',
      timestamp: new Date().toISOString()
    }
  } catch (e) {
    return {
      component: `module_${moduleName}`,
      status: 'unhealthy',
      latency: Date.now() - start,
      message: `Module check failed: ${e.message}`,
      timestamp: new Date().toISOString()
    }
  }
}

function calculateOverallHealth(results: HealthCheckResult[]): { status: 'healthy' | 'degraded' | 'unhealthy', score: number } {
  const unhealthy = results.filter(r => r.status === 'unhealthy').length
  const degraded = results.filter(r => r.status === 'degraded').length
  const total = results.length
  
  const score = Math.round(((total - unhealthy - degraded * 0.5) / total) * 100)
  
  if (unhealthy > 0) return { status: 'unhealthy', score }
  if (degraded > 0) return { status: 'degraded', score }
  return { status: 'healthy', score }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = adminClient()
    const { action } = await req.json()

    if (action === 'health_check') {
      // Run comprehensive health checks
      const results: HealthCheckResult[] = []
      
      // Core infrastructure
      results.push(await checkDatabaseHealth(admin))
      results.push(await checkStorageHealth(admin))
      
      // Key edge functions
      results.push(await checkEdgeFunctionHealth(admin, 'api-gateway'))
      results.push(await checkEdgeFunctionHealth(admin, 'auto-apk-pipeline'))
      
      // Key modules
      results.push(await checkModuleHealth(admin, 'products'))
      results.push(await checkModuleHealth(admin, 'keys'))
      results.push(await checkModuleHealth(admin, 'wallets'))
      results.push(await checkModuleHealth(admin, 'deployments'))
      
      const overall = calculateOverallHealth(results)
      
      // Store health check result
      await admin.from('system_health_logs').insert({
        overall_status: overall.status,
        health_score: overall.score,
        component_results: results,
        checked_at: new Date().toISOString()
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Health check completed',
        data: {
          overall,
          results,
          timestamp: new Date().toISOString()
        }
      }), { headers: corsHeaders })
    }

    if (action === 'get_status') {
      // Get latest health status
      const { data, error } = await admin
        .from('system_health_logs')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to fetch health status',
          data: null
        }), { status: 500, headers: corsHeaders })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Health status retrieved',
        data: data || { overall_status: 'unknown', health_score: 0 }
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
      message: `Monitor error: ${error.message}`,
      data: null
    }), { status: 500, headers: corsHeaders })
  }
})
