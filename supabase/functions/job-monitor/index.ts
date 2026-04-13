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

// Background Job Monitor
// Track: APK build, email send, key generation
// If stuck: restart job

interface JobStatus {
  jobId: string
  jobType: 'apk_build' | 'key_generation' | 'email_send' | 'deployment' | 'vala_builder'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stuck'
  startedAt: string
  duration: number
  lastUpdate: string
}

const STUCK_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

async function checkAPKBuildJobs(admin: any): Promise<JobStatus[]> {
  const jobs: JobStatus[] = []
  
  try {
    const { data, error } = await admin
      .from('apk_build_queue')
      .select('*')
      .in('build_status', ['pending', 'building'])
      .order('created_at', { ascending: false })
    
    if (error || !data) return jobs
    
    for (const job of data) {
      const startedAt = new Date(job.created_at || job.updated_at).getTime()
      const now = Date.now()
      const duration = now - startedAt
      const lastUpdate = job.updated_at || job.created_at
      
      let status: JobStatus['status'] = job.build_status === 'pending' ? 'pending' : 'running'
      
      if (duration > STUCK_THRESHOLD_MS) {
        status = 'stuck'
        // Auto-restart stuck job
        await admin.from('apk_build_queue').update({ 
          build_status: 'pending',
          updated_at: new Date().toISOString()
        }).eq('id', job.id)
        
        await admin.from('job_monitor_logs').insert({
          job_id: job.id,
          job_type: 'apk_build',
          action: 'auto_restart',
          reason: `Job stuck for ${Math.round(duration / 60000)} minutes`,
          created_at: new Date().toISOString()
        })
      }
      
      jobs.push({
        jobId: job.id,
        jobType: 'apk_build',
        status,
        startedAt: job.created_at,
        duration,
        lastUpdate
      })
    }
  } catch (e) {
    console.error('Error checking APK build jobs:', e)
  }
  
  return jobs
}

async function checkDeploymentJobs(admin: any): Promise<JobStatus[]> {
  const jobs: JobStatus[] = []
  
  try {
    const { data, error } = await admin
      .from('deployments')
      .select('*')
      .in('status', ['queued', 'deploying'])
      .order('created_at', { ascending: false })
    
    if (error || !data) return jobs
    
    for (const job of data) {
      const startedAt = new Date(job.created_at || job.updated_at).getTime()
      const now = Date.now()
      const duration = now - startedAt
      const lastUpdate = job.updated_at || job.created_at
      
      let status: JobStatus['status'] = job.status === 'queued' ? 'pending' : 'running'
      
      if (duration > STUCK_THRESHOLD_MS) {
        status = 'stuck'
        // Mark as failed for manual review
        await admin.from('deployments').update({ 
          status: 'failed',
          error_message: `Deployment stuck for ${Math.round(duration / 60000)} minutes - auto-failed`,
          updated_at: new Date().toISOString()
        }).eq('id', job.id)
        
        await admin.from('job_monitor_logs').insert({
          job_id: job.id,
          job_type: 'deployment',
          action: 'auto_fail',
          reason: `Job stuck for ${Math.round(duration / 60000)} minutes`,
          created_at: new Date().toISOString()
        })
      }
      
      jobs.push({
        jobId: job.id,
        jobType: 'deployment',
        status,
        startedAt: job.created_at,
        duration,
        lastUpdate
      })
    }
  } catch (e) {
    console.error('Error checking deployment jobs:', e)
  }
  
  return jobs
}

async function checkValaBuilderRuns(admin: any): Promise<JobStatus[]> {
  const jobs: JobStatus[] = []
  
  try {
    const { data, error } = await admin
      .from('vala_builder_runs')
      .select('*')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
    
    if (error || !data) return jobs
    
    for (const job of data) {
      const startedAt = new Date(job.created_at || job.updated_at).getTime()
      const now = Date.now()
      const duration = now - startedAt
      const lastUpdate = job.updated_at || job.created_at
      
      let status: JobStatus['status'] = job.status === 'queued' ? 'pending' : 'running'
      
      if (duration > STUCK_THRESHOLD_MS) {
        status = 'stuck'
        // Mark as failed
        await admin.from('vala_builder_runs').update({ 
          status: 'failed',
          error_message: `Build stuck for ${Math.round(duration / 60000)} minutes`,
          updated_at: new Date().toISOString()
        }).eq('id', job.id)
        
        await admin.from('job_monitor_logs').insert({
          job_id: job.id,
          job_type: 'vala_builder',
          action: 'auto_fail',
          reason: `Job stuck for ${Math.round(duration / 60000)} minutes`,
          created_at: new Date().toISOString()
        })
      }
      
      jobs.push({
        jobId: job.id,
        jobType: 'vala_builder',
        status,
        startedAt: job.created_at,
        duration,
        lastUpdate
      })
    }
  } catch (e) {
    console.error('Error checking Vala Builder runs:', e)
  }
  
  return jobs
}

async function restartStuckJob(admin: any, job: JobStatus): Promise<boolean> {
  try {
    switch (job.jobType) {
      case 'apk_build':
        await admin.from('apk_build_queue').update({ 
          build_status: 'pending',
          updated_at: new Date().toISOString()
        }).eq('id', job.jobId)
        break
      case 'deployment':
        await admin.from('deployments').update({ 
          status: 'queued',
          updated_at: new Date().toISOString()
        }).eq('id', job.jobId)
        break
      case 'vala_builder':
        await admin.from('vala_builder_runs').update({ 
          status: 'queued',
          updated_at: new Date().toISOString(),
          error_message: null,
        }).eq('id', job.jobId)
        break
      default:
        return false
    }
    
    await admin.from('job_monitor_logs').insert({
      job_id: job.jobId,
      job_type: job.jobType,
      action: 'manual_restart',
      reason: 'Manual restart requested',
      created_at: new Date().toISOString()
    })
    
    return true
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = adminClient()
    const { action, job_id, job_type } = await req.json()

    if (action === 'check') {
      const allJobs: JobStatus[] = []
      
      // Check all job types
      allJobs.push(...await checkAPKBuildJobs(admin))
      allJobs.push(...await checkDeploymentJobs(admin))
      allJobs.push(...await checkValaBuilderRuns(admin))
      
      const stuckJobs = allJobs.filter(j => j.status === 'stuck')
      const runningJobs = allJobs.filter(j => j.status === 'running')
      const pendingJobs = allJobs.filter(j => j.status === 'pending')
      
      // Store monitoring result
      await admin.from('job_monitor_reports').insert({
        total_jobs: allJobs.length,
        stuck_jobs: stuckJobs.length,
        running_jobs: runningJobs.length,
        pending_jobs: pendingJobs.length,
        job_details: allJobs,
        checked_at: new Date().toISOString()
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Job monitor check completed',
        data: {
          total: allJobs.length,
          stuck: stuckJobs.length,
          running: runningJobs.length,
          pending: pendingJobs.length,
          jobs: allJobs
        }
      }), { headers: corsHeaders })
    }

    if (action === 'restart') {
      if (!job_id || !job_type) {
        return new Response(JSON.stringify({
          success: false,
          message: 'job_id and job_type are required',
          data: null
        }), { status: 400, headers: corsHeaders })
      }
      
      const job: JobStatus = {
        jobId: job_id,
        jobType: job_type as any,
        status: 'stuck',
        startedAt: new Date().toISOString(),
        duration: 0,
        lastUpdate: new Date().toISOString()
      }
      
      const restarted = await restartStuckJob(admin, job)
      
      return new Response(JSON.stringify({
        success: restarted,
        message: restarted ? 'Job restarted successfully' : 'Failed to restart job',
        data: { job_id, job_type, restarted }
      }), { headers: corsHeaders })
    }

    if (action === 'get_status') {
      const { data, error } = await admin
        .from('job_monitor_reports')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(10)
      
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to fetch job monitor status',
          data: null
        }), { status: 500, headers: corsHeaders })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Job monitor status retrieved',
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
      message: `Job monitor error: ${error.message}`,
      data: null
    }), { status: 500, headers: corsHeaders })
  }
})
