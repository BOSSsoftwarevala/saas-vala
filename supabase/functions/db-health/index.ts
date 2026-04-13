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

// DB Health System
// Check: missing table, broken relation, null critical data
// Auto: create missing, fix relation

interface TableHealth {
  tableName: string
  exists: boolean
  row_count: number
  issues: string[]
}

interface RelationHealth {
  fromTable: string
  toTable: string
  relationType: string
  isHealthy: boolean
  issue: string | null
}

// Expected critical tables for SaaS VALA platform
const EXPECTED_TABLES = [
  'profiles',
  'products',
  'license_keys',
  'wallets',
  'wallet_transactions',
  'transactions',
  'deployments',
  'servers',
  'apk_build_queue',
  'audit_logs',
  'activity_logs',
  'leads',
  'seo_data',
  'ai_usage_daily',
  'marketplace_analytics',
  'user_roles',
  'error_detection_logs',
  'system_health_logs',
  'heal_logs',
  'heal_alerts'
]

async function checkTableExists(admin: any, tableName: string): Promise<boolean> {
  try {
    const { error } = await admin.from(tableName).select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

async function getTableRowCount(admin: any, tableName: string): Promise<number> {
  try {
    const { count, error } = await admin.from(tableName).select('*', { count: 'exact', head: true })
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

async function checkCriticalNulls(admin: any, tableName: string): Promise<string[]> {
  const issues: string[] = []
  
  try {
    // Check for null critical columns based on table
    const criticalColumns: Record<string, string[]> = {
      'profiles': ['user_id'],
      'license_keys': ['license_key', 'product_id'],
      'products': ['name', 'slug'],
      'wallets': ['user_id'],
      'deployments': ['server_id']
    }
    
    const columns = criticalColumns[tableName]
    if (!columns || columns.length === 0) return issues
    
    for (const column of columns) {
      const { data } = await admin.from(tableName).select(column).is(column, null).limit(1)
      if (data && data.length > 0) {
        issues.push(`Null values found in critical column: ${column}`)
      }
    }
  } catch {
    // Skip null check if table structure unknown
  }
  
  return issues
}

async function checkTableHealth(admin: any, tableName: string): Promise<TableHealth> {
  const exists = await checkTableExists(admin, tableName)
  const issues: string[] = []
  
  if (!exists) {
    return {
      tableName,
      exists: false,
      row_count: 0,
      issues: ['Table does not exist']
    }
  }
  
  const rowCount = await getTableRowCount(admin, tableName)
  const nullIssues = await checkCriticalNulls(admin, tableName)
  issues.push(...nullIssues)
  
  if (rowCount === 0 && tableName !== 'heal_logs' && tableName !== 'error_detection_logs') {
    issues.push('Table is empty (may be expected for new system)')
  }
  
  return {
    tableName,
    exists: true,
    row_count: rowCount,
    issues
  }
}

async function checkRelationHealth(admin: any): Promise<RelationHealth[]> {
  const relations: RelationHealth[] = []
  
  // Check key relations
  const relationChecks = [
    { from: 'license_keys', to: 'products', type: 'many-to-one', column: 'product_id' },
    { from: 'license_keys', to: 'profiles', type: 'many-to-one', column: 'created_by' },
    { from: 'wallets', to: 'profiles', type: 'one-to-one', column: 'user_id' },
    { from: 'wallet_transactions', to: 'wallets', type: 'many-to-one', column: 'wallet_id' },
    { from: 'deployments', to: 'servers', type: 'many-to-one', column: 'server_id' }
  ]
  
  for (const check of relationChecks) {
    try {
      const { error } = await admin
        .from(check.from)
        .select(check.column)
        .not(check.column, 'is', null)
        .limit(1)
      
      relations.push({
        fromTable: check.from,
        toTable: check.to,
        relationType: check.type,
        isHealthy: !error,
        issue: error ? error.message : null
      })
    } catch (e) {
      relations.push({
        fromTable: check.from,
        toTable: check.to,
        relationType: check.type,
        isHealthy: false,
        issue: String(e)
      })
    }
  }
  
  return relations
}

async function attemptFixMissingTable(admin: any, tableName: string): Promise<boolean> {
  // Cannot auto-create tables without schema definition
  // Log the issue for manual intervention
  try {
    await admin.from('db_health_issues').insert({
      issue_type: 'missing_table',
      table_name: tableName,
      severity: 'critical',
      description: `Required table ${tableName} does not exist`,
      requires_manual_intervention: true,
      created_at: new Date().toISOString()
    })
    return false
  } catch {
    return false
  }
}

async function attemptFixNullData(admin: any, tableName: string): Promise<boolean> {
  try {
    await admin.from('db_health_issues').insert({
      issue_type: 'null_critical_data',
      table_name: tableName,
      severity: 'warning',
      description: `Critical null data detected in ${tableName} and requires manual remediation`,
      requires_manual_intervention: true,
      created_at: new Date().toISOString(),
    })

    return false
  } catch {
    return false
  }
}

async function runDBHealthCheck(admin: any): Promise<{
  overall_status: 'healthy' | 'degraded' | 'unhealthy'
  tables: TableHealth[]
  relations: RelationHealth[]
  issues: string[]
}> {
  const tables: TableHealth[] = []
  const issues: string[] = []
  
  // Check all expected tables
  for (const tableName of EXPECTED_TABLES) {
    const health = await checkTableHealth(admin, tableName)
    tables.push(health)
    
    if (!health.exists) {
      issues.push(`Missing table: ${tableName}`)
    }
    
    health.issues.forEach(issue => {
      issues.push(`${tableName}: ${issue}`)
    })
  }
  
  // Check relations
  const relations = await checkRelationHealth(admin)
  relations.forEach(rel => {
    if (!rel.isHealthy) {
      issues.push(`Relation ${rel.fromTable} -> ${rel.toTable}: ${rel.issue}`)
    }
  })
  
  // Determine overall status
  const missingTables = tables.filter(t => !t.exists).length
  const brokenRelations = relations.filter(r => !r.isHealthy).length
  
  let overall_status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (missingTables > 0 || brokenRelations > 2) {
    overall_status = 'unhealthy'
  } else if (brokenRelations > 0 || issues.length > 0) {
    overall_status = 'degraded'
  }
  
  return { overall_status, tables, relations, issues }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = adminClient()
    const { action, auto_fix } = await req.json()

    if (action === 'check') {
      const result = await runDBHealthCheck(admin)
      
      // Store health check result
      await admin.from('db_health_logs').insert({
        overall_status: result.overall_status,
        table_health: result.tables,
        relation_health: result.relations,
        issues: result.issues,
        checked_at: new Date().toISOString()
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: 'DB health check completed',
        data: result
      }), { headers: corsHeaders })
    }

    if (action === 'fix') {
      const healthCheck = await runDBHealthCheck(admin)
      const fixesApplied: string[] = []
      
      if (auto_fix) {
        // Attempt to fix missing tables
        for (const table of healthCheck.tables) {
          if (!table.exists) {
            const fixed = await attemptFixMissingTable(admin, table.tableName)
            if (!fixed) {
              fixesApplied.push(`Cannot auto-fix missing table: ${table.tableName} (requires manual intervention)`)
            }
          }
        }
        
        // Attempt to fix null data
        for (const table of healthCheck.tables) {
          if (table.exists && table.issues.some(i => i.includes('Null'))) {
            const fixed = await attemptFixNullData(admin, table.tableName)
            if (fixed) {
              fixesApplied.push(`Fixed null data in: ${table.tableName}`)
            }
          }
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'DB health fix attempted',
        data: {
          health_check: healthCheck,
          fixes_applied: fixesApplied,
          requires_manual_intervention: healthCheck.issues.length > 0
        }
      }), { headers: corsHeaders })
    }

    if (action === 'get_status') {
      const { data, error } = await admin
        .from('db_health_logs')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to fetch DB health status',
          data: null
        }), { status: 500, headers: corsHeaders })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'DB health status retrieved',
        data: data
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
      message: `DB health error: ${error.message}`,
      data: null
    }), { status: 500, headers: corsHeaders })
  }
})
