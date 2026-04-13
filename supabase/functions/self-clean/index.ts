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

// Self Clean System
// Auto remove: temp files, failed builds, unused data

interface CleanResult {
  type: string
  cleaned: number
  details: string
}

const FAILED_BUILD_AGE_DAYS = 7
const LOG_RETENTION_DAYS = 30
const TEMP_FILE_AGE_HOURS = 24

async function cleanFailedBuilds(admin: any): Promise<CleanResult> {
  let cleaned = 0
  const cutoffDate = new Date(Date.now() - FAILED_BUILD_AGE_DAYS * 24 * 60 * 60 * 1000)
  
  try {
    // Clean failed APK builds
    const { data: failedApks, error: apkError } = await admin
      .from('apk_build_queue')
      .select('*')
      .eq('build_status', 'failed')
      .lt('created_at', cutoffDate.toISOString())
    
    if (!apkError && failedApks) {
      for (const apk of failedApks) {
        // Delete from storage if file exists
        if (apk.apk_file_path) {
          try {
            await admin.storage.from('apks').remove([apk.apk_file_path])
          } catch {
            // File may not exist, continue
          }
        }
        // Mark as archived instead of deleting
        await admin.from('apk_build_queue').update({ 
          build_status: 'archived',
          archived_at: new Date().toISOString()
        }).eq('id', apk.id)
        cleaned++
      }
    }
    
    // Clean failed deployments
    const { data: failedDeployments, error: deployError } = await admin
      .from('deployments')
      .select('*')
      .eq('status', 'failed')
      .lt('created_at', cutoffDate.toISOString())
    
    if (!deployError && failedDeployments) {
      for (const deploy of failedDeployments) {
        await admin.from('deployments').update({ 
          status: 'archived',
          archived_at: new Date().toISOString()
        }).eq('id', deploy.id)
        cleaned++
      }
    }
    
    return {
      type: 'failed_builds',
      cleaned,
      details: `Archived ${cleaned} failed builds older than ${FAILED_BUILD_AGE_DAYS} days`
    }
  } catch (e) {
    return {
      type: 'failed_builds',
      cleaned: 0,
      details: `Error: ${e.message}`
    }
  }
}

async function cleanOldLogs(admin: any): Promise<CleanResult> {
  let cleaned = 0
  const cutoffDate = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  
  try {
    // Clean old audit logs
    const { error: auditError } = await admin
      .from('audit_logs')
      .delete()
      .lt('occurred_at_utc', cutoffDate.toISOString())
    
    if (!auditError) cleaned++
    
    // Clean old error detection logs
    const { error: errorError } = await admin
      .from('error_detection_logs')
      .delete()
      .lt('detected_at', cutoffDate.toISOString())
    
    if (!errorError) cleaned++
    
    // Clean old job monitor reports
    const { error: jobError } = await admin
      .from('job_monitor_reports')
      .delete()
      .lt('checked_at', cutoffDate.toISOString())
    
    if (!jobError) cleaned++
    
    return {
      type: 'old_logs',
      cleaned,
      details: `Deleted logs older than ${LOG_RETENTION_DAYS} days from ${cleaned} tables`
    }
  } catch (e) {
    return {
      type: 'old_logs',
      cleaned: 0,
      details: `Error: ${e.message}`
    }
  }
}

async function cleanUnusedData(admin: any): Promise<CleanResult> {
  let cleaned = 0
  
  try {
    // Clean orphaned wallet transactions (where wallet doesn't exist)
    const { data: orphanedTxns, error } = await admin.rpc('clean_orphaned_transactions')
    if (error) {
      return {
        type: 'unused_data',
        cleaned: 0,
        details: 'Skipped orphan cleanup: clean_orphaned_transactions RPC is unavailable'
      }
    }
    if (orphanedTxns) cleaned += orphanedTxns
    
    return {
      type: 'unused_data',
      cleaned,
      details: `Cleaned ${cleaned} orphaned records`
    }
  } catch (e) {
    return {
      type: 'unused_data',
      cleaned: 0,
      details: `Error: ${e.message}`
    }
  }
}

async function cleanTempStorage(admin: any): Promise<CleanResult> {
  let cleaned = 0
  
  try {
    // List files in temp storage bucket
    const { data: files, error } = await admin.storage.listBuckets()
    
    if (!error && files) {
      const tempBucket = files.find(b => b.name === 'temp')
      if (tempBucket) {
        const { data: tempFiles } = await admin.storage.from('temp').list()
        
        if (tempFiles) {
          const cutoffDate = new Date(Date.now() - TEMP_FILE_AGE_HOURS * 60 * 60 * 1000)
          
          for (const file of tempFiles) {
            if (file.created_at && new Date(file.created_at) < cutoffDate) {
              try {
                await admin.storage.from('temp').remove([file.name])
                cleaned++
              } catch {
                // File may be locked, skip
              }
            }
          }
        }
      }
    }
    
    return {
      type: 'temp_storage',
      cleaned,
      details: `Deleted ${cleaned} temp files older than ${TEMP_FILE_AGE_HOURS} hours`
    }
  } catch (e) {
    return {
      type: 'temp_storage',
      cleaned: 0,
      details: `Error: ${e.message}`
    }
  }
}

async function cleanStuckSessions(admin: any): Promise<CleanResult> {
  let cleaned = 0
  
  try {
    // Clean stuck job monitor reports (keep only last 100)
    const { data: oldReports } = await admin
      .from('job_monitor_reports')
      .select('id')
      .order('checked_at', { ascending: false })
      .range(100, 999999)
    
    if (oldReports && oldReports.length > 0) {
      const ids = oldReports.map(r => r.id)
      const { error } = await admin
        .from('job_monitor_reports')
        .delete()
        .in('id', ids)
      
      if (!error) cleaned = oldReports.length
    }
    
    // Clean old system health logs (keep only last 100)
    const { data: oldHealthLogs } = await admin
      .from('system_health_logs')
      .select('id')
      .order('checked_at', { ascending: false })
      .range(100, 999999)
    
    if (oldHealthLogs && oldHealthLogs.length > 0) {
      const ids = oldHealthLogs.map(r => r.id)
      const { error } = await admin
        .from('system_health_logs')
        .delete()
        .in('id', ids)
      
      if (!error) cleaned += oldHealthLogs.length
    }
    
    return {
      type: 'stuck_sessions',
      cleaned,
      details: `Cleaned ${cleaned} old monitoring records`
    }
  } catch (e) {
    return {
      type: 'stuck_sessions',
      cleaned: 0,
      details: `Error: ${e.message}`
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = adminClient()
    const { action, clean_type } = await req.json()

    if (action === 'clean') {
      const results: CleanResult[] = []
      
      if (!clean_type || clean_type === 'failed_builds') {
        results.push(await cleanFailedBuilds(admin))
      }
      
      if (!clean_type || clean_type === 'old_logs') {
        results.push(await cleanOldLogs(admin))
      }
      
      if (!clean_type || clean_type === 'unused_data') {
        results.push(await cleanUnusedData(admin))
      }
      
      if (!clean_type || clean_type === 'temp_storage') {
        results.push(await cleanTempStorage(admin))
      }
      
      if (!clean_type || clean_type === 'stuck_sessions') {
        results.push(await cleanStuckSessions(admin))
      }
      
      const totalCleaned = results.reduce((sum, r) => sum + r.cleaned, 0)
      
      // Log clean operation
      await admin.from('self_clean_logs').insert({
        results,
        total_cleaned: totalCleaned,
        performed_at: new Date().toISOString()
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Self clean completed',
        data: {
          total_cleaned: totalCleaned, // Fix ReferenceError by returning computed totalCleaned value
          results
        }
      }), { headers: corsHeaders })
    }

    if (action === 'get_status') {
      const { data, error } = await admin
        .from('self_clean_logs')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(10)
      
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to fetch clean status',
          data: null
        }), { status: 500, headers: corsHeaders })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Clean status retrieved',
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
      message: `Self clean error: ${error.message}`,
      data: null
    }), { status: 500, headers: corsHeaders })
  }
})
