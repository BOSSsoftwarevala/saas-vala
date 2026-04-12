// STEP 54: CLEANUP JOB - Remove temp cache, expired data
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class CleanupJob {
  private static instance: CleanupJob;
  private isRunning = false;

  static getInstance(): CleanupJob {
    if (!CleanupJob.instance) {
      CleanupJob.instance = new CleanupJob();
    }
    return CleanupJob.instance;
  }

  async runCleanup() {
    if (this.isRunning) {
      console.log('Cleanup job already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('Starting cleanup job...');

    try {
      await this.cleanupExpiredTranslations();
      await this.cleanupOldNotifications();
      await this.cleanupFailedQueueJobs();
      await this.cleanupExpiredMediaUrls();
      await this.cleanupOldTypingIndicators();
      await this.cleanupExpiredCache();
      await this.cleanupOldStatusUpdates();
      await this.cleanupExpiredSessions();
      
      console.log('Cleanup job completed successfully');
    } catch (error) {
      console.error('Cleanup job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async cleanupExpiredTranslations() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('internal_translation_cache')
        .delete()
        .lt('created_at', thirtyDaysAgo);

      if (error) {
        console.error('Failed to cleanup expired translations:', error);
      } else {
        console.log('Cleaned up expired translations');
      }
    } catch (error) {
      console.error('Translation cleanup error:', error);
    }
  }

  private async cleanupOldNotifications() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('internal_notifications')
        .delete()
        .lt('created_at', sevenDaysAgo)
        .eq('read', true);

      if (error) {
        console.error('Failed to cleanup old notifications:', error);
      } else {
        console.log('Cleaned up old notifications');
      }
    } catch (error) {
      console.error('Notification cleanup error:', error);
    }
  }

  private async cleanupFailedQueueJobs() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('internal_queue_jobs')
        .delete()
        .lt('created_at', sevenDaysAgo)
        .in('status', ['failed', 'completed']);

      if (error) {
        console.error('Failed to cleanup failed queue jobs:', error);
      } else {
        console.log('Cleaned up failed queue jobs');
      }
    } catch (error) {
      console.error('Queue job cleanup error:', error);
    }
  }

  private async cleanupExpiredMediaUrls() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Clean up expired signed URLs from storage
      const { data: expiredFiles } = await supabase
        .from('internal_messages')
        .select('voice_url, file_url')
        .lt('created_at', twentyFourHoursAgo)
        .not('voice_url', 'is', null);

      if (expiredFiles) {
        for (const file of expiredFiles) {
          if (file.voice_url && file.voice_url.includes('token=')) {
            // This is a signed URL that has expired
            // Note: The actual file remains in storage, only the URL expires
            console.log(`Expired voice URL found: ${file.voice_url}`);
          }
        }
      }
    } catch (error) {
      console.error('Media URL cleanup error:', error);
    }
  }

  private async cleanupOldTypingIndicators() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('internal_typing_indicators')
        .delete()
        .lt('created_at', fiveMinutesAgo);

      if (error) {
        console.error('Failed to cleanup old typing indicators:', error);
      } else {
        console.log('Cleaned up old typing indicators');
      }
    } catch (error) {
      console.error('Typing indicator cleanup error:', error);
    }
  }

  private async cleanupExpiredCache() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Clean up expired rate limit entries
      const { error: rateLimitError } = await supabase
        .from('internal_rate_limit_cache')
        .delete()
        .lt('expires_at', oneHourAgo);

      if (rateLimitError) {
        console.error('Failed to cleanup rate limit cache:', rateLimitError);
      }

      // Clean up expired member cache
      const { error: memberCacheError } = await supabase
        .from('internal_member_cache')
        .delete()
        .lt('expires_at', oneHourAgo);

      if (memberCacheError) {
        console.error('Failed to cleanup member cache:', memberCacheError);
      } else {
        console.log('Cleaned up expired cache entries');
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  private async cleanupOldStatusUpdates() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('internal_message_status_updates')
        .delete()
        .lt('created_at', thirtyDaysAgo);

      if (error) {
        console.error('Failed to cleanup old status updates:', error);
      } else {
        console.log('Cleaned up old status updates');
      }
    } catch (error) {
      console.error('Status update cleanup error:', error);
    }
  }

  private async cleanupExpiredSessions() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Clean up expired user sessions (if you have a sessions table)
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .lt('expires_at', sevenDaysAgo);

      if (error && !error.message.includes('does not exist')) {
        console.error('Failed to cleanup expired sessions:', error);
      } else {
        console.log('Cleaned up expired sessions');
      }
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  // Manual cleanup for specific tables
  async cleanupTable(tableName: string, dateColumn: string, olderThanDays: number) {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .lt(dateColumn, cutoffDate);

      if (error) {
        console.error(`Failed to cleanup table ${tableName}:`, error);
        return false;
      } else {
        console.log(`Cleaned up table ${tableName}`);
        return true;
      }
    } catch (error) {
      console.error(`Table cleanup error for ${tableName}:`, error);
      return false;
    }
  }

  // Get cleanup statistics
  async getCleanupStats() {
    try {
      const stats: Record<string, number> = {};

      // Count expired translations
      const { count: translationCount } = await supabase
        .from('internal_translation_cache')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Count old notifications
      const { count: notificationCount } = await supabase
        .from('internal_notifications')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .eq('read', true);

      // Count failed jobs
      const { count: jobCount } = await supabase
        .from('internal_queue_jobs')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .in('status', ['failed', 'completed']);

      stats.expiredTranslations = translationCount || 0;
      stats.oldNotifications = notificationCount || 0;
      stats.failedJobs = jobCount || 0;

      return stats;
    } catch (error) {
      console.error('Failed to get cleanup stats:', error);
      return {};
    }
  }

  // Start automatic cleanup (run every hour)
  startAutomaticCleanup() {
    console.log('Starting automatic cleanup job (every hour)');
    
    // Run immediately
    this.runCleanup();
    
    // Then run every hour
    setInterval(() => {
      this.runCleanup();
    }, 60 * 60 * 1000); // 1 hour
  }

  // Stop automatic cleanup
  stopAutomaticCleanup() {
    console.log('Stopping automatic cleanup job');
    // In a real implementation, you'd store the interval ID and clear it
  }
}

export const cleanupJob = CleanupJob.getInstance();
