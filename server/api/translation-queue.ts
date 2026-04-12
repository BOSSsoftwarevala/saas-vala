// STEP 44: BACKGROUND TRANSLATION QUEUE - Async translation system
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TranslationJob {
  message_id: string;
  text: string;
  source_language: string;
  target_languages: string[];
  priority: 'high' | 'normal' | 'low';
  created_at: string;
  attempts: number;
}

class TranslationQueue {
  private queue: TranslationJob[] = [];
  private processing = false;
  private maxRetries = 3;
  private batchSize = 5;

  async addJob(job: TranslationJob) {
    // Add to database queue first for persistence
    await supabase
      .from('internal_translation_queue')
      .insert({
        message_id: job.message_id,
        text: job.text,
        source_language: job.source_language,
        target_languages: job.target_languages,
        priority: job.priority,
        attempts: 0,
        status: 'pending'
      });

    this.queue.push(job);
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    console.log('Starting translation queue processing...');

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      
      await Promise.allSettled(
        batch.map(job => this.processJob(job))
      );
    }

    this.processing = false;
    console.log('Translation queue processing completed');
  }

  private async processJob(job: TranslationJob) {
    try {
      // Get API key
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!apiKey) {
        throw new Error('Translation API not configured');
      }

      // Process each target language
      for (const targetLang of job.target_languages) {
        if (targetLang === job.source_language) continue; // Skip same language

        // Check cache first
        const { data: cached } = await supabase
          .from('internal_translation_cache')
          .select('translated_text')
          .eq('original_text', job.text)
          .eq('target_language', targetLang)
          .single();

        if (cached) {
          await this.updateMessageTranslation(job.message_id, targetLang, cached.translated_text);
          continue;
        }

        // Translate via API
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: job.text,
              source: job.source_language,
              target: targetLang,
              format: 'text'
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Translation API error: ${response.statusText}`);
        }

        const data = await response.json();
        const translatedText = data.data.translations[0].translatedText;

        // Cache the translation
        await supabase
          .from('internal_translation_cache')
          .upsert({
            original_text: job.text,
            target_language: targetLang,
            translated_text: translatedText,
            created_at: new Date().toISOString()
          });

        // Update message with translation
        await this.updateMessageTranslation(job.message_id, targetLang, translatedText);
      }

      // Mark job as completed
      await supabase
        .from('internal_translation_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('message_id', job.message_id);

    } catch (error) {
      console.error(`Translation failed for message ${job.message_id}:`, error);
      
      // Update attempts and possibly retry
      job.attempts++;
      if (job.attempts < this.maxRetries) {
        // Re-add to queue for retry
        this.queue.push(job);
      } else {
        // Mark as failed
        await supabase
          .from('internal_translation_queue')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            attempts: job.attempts
          })
          .eq('message_id', job.message_id);
      }
    }
  }

  private async updateMessageTranslation(messageId: string, language: string, translation: string) {
    const { data: message } = await supabase
      .from('internal_messages')
      .select('translated_text')
      .eq('id', messageId)
      .single();

    if (message) {
      const updatedTranslations = {
        ...message.translated_text,
        [language]: translation
      };

      await supabase
        .from('internal_messages')
        .update({ translated_text: updatedTranslations })
        .eq('id', messageId);

      // Broadcast translation update via realtime
      // This would trigger a realtime event to update the UI
    }
  }

  // Load pending jobs from database on startup
  async loadPendingJobs() {
    const { data: pendingJobs } = await supabase
      .from('internal_translation_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', this.maxRetries)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (pendingJobs) {
      this.queue = pendingJobs.map(job => ({
        message_id: job.message_id,
        text: job.text,
        source_language: job.source_language,
        target_languages: job.target_languages,
        priority: job.priority,
        created_at: job.created_at,
        attempts: job.attempts
      }));

      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }
}

// Global queue instance
const translationQueue = new TranslationQueue();

// Initialize queue on module load
translationQueue.loadPendingJobs();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { message_id, text, source_language, target_languages, priority = 'normal' } = req.body;

    if (!message_id || !text || !source_language || !target_languages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      await translationQueue.addJob({
        message_id,
        text,
        source_language,
        target_languages,
        priority,
        created_at: new Date().toISOString(),
        attempts: 0
      });

      res.status(200).json({ 
        message: 'Translation job queued',
        queue_length: translationQueue['queue'].length
      });
    } catch (error) {
      console.error('Queue error:', error);
      res.status(500).json({ error: 'Failed to queue translation' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
