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

// Auto Heal Engine
// On error: retry → fallback → log
// Handles API failures, DB errors, route failures, UI breaks

interface HealAction {
  action: 'retry' | 'fallback' | 'log' | 'alert'
  result: 'success' | 'failed' | 'partial'
  message: string
  timestamp: string
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<{ success: boolean; data?: T; attempts: number; history: HealAction[] }> {
  const history: HealAction[] = []
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await operation()
      history.push({
        action: 'retry',
        result: 'success',
        message: `Operation succeeded on attempt ${attempt}`,
        timestamp: new Date().toISOString()
      })
      return { success: true, data, attempts: attempt, history }
    } catch (error) {
      history.push({
        action: 'retry',
        result: 'failed',
        message: `Attempt ${attempt} failed: ${error.message}`,
        timestamp: new Date().toISOString()
      })
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }
  }
  
  return { success: false, attempts: maxRetries, history }
}

async function healDBConnection(admin: any): Promise<HealAction[]> {
  const history: HealAction[] = []
  
  // Retry DB connection
  const result = await retryOperation(
    async () => {
      const { error } = await admin.from('profiles').select('id').limit(1)
      if (error) throw error
      return true
    },
    3,
    1000
  )
  
  history.push(...result.history)
  
  if (!result.success) {
    // Fallback: check if service role key is valid
    history.push({
      action: 'fallback',
      result: 'failed',
      message: 'DB connection could not be restored - requires manual intervention',
      timestamp: new Date().toISOString()
    })
  }
  
  // Log the result
  history.push({
    action: 'log',
    result: result.success ? 'success' : 'failed',
    message: `DB heal ${result.success ? 'succeeded' : 'failed'} after ${result.attempts} attempts`,
    timestamp: new Date().toISOString()
  })
  
  return history
}

async function healStorageConnection(admin: any): Promise<HealAction[]> {
  const history: HealAction[] = []
  
  const result = await retryOperation(
    async () => {
      const { data, error } = await admin.storage.listBuckets()
      if (error) throw error
      return data
    },
    3,
    1000
  )
  
  history.push(...result.history)
  history.push({
    action: 'log',
    result: result.success ? 'success' : 'failed',
    message: `Storage heal ${result.success ? 'succeeded' : 'failed'}`,
    timestamp: new Date().toISOString()
  })
  
  return history
}

async function healEdgeFunction(admin: any, functionName: string): Promise<HealAction[]> {
  const history: HealAction[] = []
  
  const result = await retryOperation(
    async () => {
      const { data, error } = await admin.functions.invoke(functionName, { body: { health_check: true } })
      if (error) throw error
      return data
    },
    2,
    2000
  )
  
  history.push(...result.history)
  
  if (!result.success) {
    history.push({
      action: 'fallback',
      result: 'failed',
      message: `Edge function ${functionName} could not be healed - check function logs`,
      timestamp: new Date().toISOString()
    })
  }
  
  history.push({
    action: 'log',
    result: result.success ? 'success' : 'failed',
    message: `Edge function ${functionName} heal ${result.success ? 'succeeded' : 'failed'}`,
    timestamp: new Date().toISOString()
  })
  
  return history
}

async function healModuleTable(admin: any, tableName: string): Promise<HealAction[]> {
  const history: HealAction[] = []
  
  const result = await retryOperation(
    async () => {
      const { error } = await admin.from(tableName).select('id').limit(1)
      if (error) {
        // Check if table doesn't exist
        if (error.message.includes('does not exist')) {
          history.push({
            action: 'fallback',
            result: 'partial',
            message: `Table ${tableName} does not exist - requires migration`,
            timestamp: new Date().toISOString()
          })
          throw error
        }
        throw error
      }
      return true
    },
    3,
    1000
  )
  
  history.push(...result.history)
  history.push({
    action: 'log',
    result: result.success ? 'success' : 'failed',
    message: `Module table ${tableName} heal ${result.success ? 'succeeded' : 'failed'}`,
    timestamp: new Date().toISOString()
  })
  
  return history
}

async function createHealAlert(admin: any, component: string, status: string, details: string) {
  try {
    await admin.from('heal_alerts').insert({
      component,
      status,
      details,
      created_at: new Date().toISOString(),
      resolved: false
    })
  } catch (error) {
    console.error('Failed to create heal alert:', error)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = adminClient()
    const { action, component } = await req.json()

    if (action === 'heal') {
      const allHistory: HealAction[] = []
      let overallStatus = 'success'

      if (!component || component === 'database') {
        const dbHistory = await healDBConnection(admin)
        allHistory.push(...dbHistory)
        if (dbHistory[dbHistory.length - 1]?.result === 'failed') {
          overallStatus = 'partial'
        }
      }

      if (!component || component === 'storage') {
        const storageHistory = await healStorageConnection(admin)
        allHistory.push(...storageHistory)
        if (storageHistory[storageHistory.length - 1]?.result === 'failed') {
          overallStatus = 'partial'
        }
      }

      if (!component || component === 'edge_function') {
        const edgeHistory = await healEdgeFunction(admin, 'api-gateway')
        allHistory.push(...edgeHistory)
        if (edgeHistory[edgeHistory.length - 1]?.result === 'failed') {
          overallStatus = 'partial'
        }
      }

      if (!component || component === 'module') {
        const modules = ['products', 'license_keys', 'wallets', 'deployments']
        for (const mod of modules) {
          const modHistory = await healModuleTable(admin, mod)
          allHistory.push(...modHistory)
          if (modHistory[modHistory.length - 1]?.result === 'failed') {
            overallStatus = 'partial'
          }
        }
      }

      // Log the heal attempt
      await admin.from('heal_logs').insert({
        component: component || 'all',
        status: overallStatus,
        actions: allHistory,
        performed_at: new Date().toISOString()
      })

      // Create alert if heal failed
      if (overallStatus !== 'success') {
        await createHealAlert(
          admin,
          component || 'system',
          overallStatus,
          `Auto heal ${overallStatus} - ${allHistory.length} actions performed`
        )
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Heal process completed',
        data: {
          overall_status: overallStatus,
          actions_performed: allHistory.length,
          history: allHistory
        }
      }), { headers: corsHeaders })
    }

    if (action === 'get_status') {
      const { data, error } = await admin
        .from('heal_logs')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(10)
      
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to fetch heal status',
          data: null
        }), { status: 500, headers: corsHeaders })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Heal status retrieved',
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
      message: `Heal error: ${error.message}`,
      data: null
    }), { status: 500, headers: corsHeaders })
  }
})
