// STEP 48: MESSAGE STATUS SYNC - Update ticks across all devices
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MessageStatusUpdate {
  message_id: string;
  user_id: string;
  status: 'sent' | 'delivered' | 'read';
  device_id: string;
  timestamp: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message_id, user_id, status, device_id } = req.body as MessageStatusUpdate;

  if (!message_id || !user_id || !status || !device_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // STEP 64: READ RECEIPT SYNC DELAY FIX - Debounce read updates
    if (status === 'read') {
      // Check if there's a recent read update for this message/user
      const { data: recentUpdate } = await supabase
        .from('internal_message_status_updates')
        .select('*')
        .eq('message_id', message_id)
        .eq('user_id', user_id)
        .eq('status', 'read')
        .gte('created_at', new Date(Date.now() - 5000).toISOString()) // Last 5 seconds
        .single();

      if (recentUpdate) {
        return res.status(200).json({ 
          message: 'Read status already updated recently',
          skipped: true 
        });
      }
    }

    // Get current message to validate
    const { data: message, error: messageError } = await supabase
      .from('internal_messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // STEP 68: HARD ACCESS GUARD - Verify user can access this message
    const { data: memberCheck } = await supabase
      .from('internal_chat_members')
      .select('id')
      .eq('chat_id', message.chat_id)
      .eq('user_id', user_id)
      .single();

    if (!memberCheck) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prevent sender from marking their own messages as read/delivered
    if (message.sender_id === user_id && status !== 'sent') {
      return res.status(400).json({ error: 'Cannot update status for own message' });
    }

    // Update message status
    const updateData: any = { delivery_status: status };
    
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'read') {
      updateData.read_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('internal_messages')
      .update(updateData)
      .eq('id', message_id)
      .neq('sender_id', user_id); // Don't update sender's own message

    if (updateError) {
      throw updateError;
    }

    // Record status update for sync tracking
    await supabase
      .from('internal_message_status_updates')
      .insert({
        message_id,
        user_id,
        status,
        device_id,
        created_at: new Date().toISOString()
      });

    // STEP 48: Broadcast status update to all user's devices via realtime
    const statusUpdatePayload = {
      type: 'message_status_update',
      message_id,
      status,
      user_id,
      device_id,
      timestamp: new Date().toISOString()
    };

    // Send to user's personal channel for device sync
    await supabase
      .channel(`user-${user_id}-sync`)
      .send({
        type: 'broadcast',
        event: 'status_update',
        payload: statusUpdatePayload
      });

    // Also update chat members' last_read_at if this is a read status
    if (status === 'read') {
      await supabase
        .from('internal_chat_members')
        .update({ 
          last_read_at: new Date().toISOString(),
          last_read_message_id: message_id
        })
        .eq('chat_id', message.chat_id)
        .eq('user_id', user_id);
    }

    // Get updated message for response
    const { data: updatedMessage } = await supabase
      .from('internal_messages')
      .select('*')
      .eq('id', message_id)
      .single();

    return res.status(200).json({ 
      success: true,
      message: updatedMessage,
      status_updated: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Message status sync error:', error);
    return res.status(500).json({ error: 'Failed to sync message status' });
  }
}

// STEP 48: Sync pending status updates for a user
export async function syncPendingStatusUpdates(userId: string, deviceId: string) {
  try {
    // Get all pending status updates from other devices
    const { data: pendingUpdates } = await supabase
      .from('internal_message_status_updates')
      .select('*')
      .eq('user_id', userId)
      .neq('device_id', deviceId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: true });

    if (!pendingUpdates || pendingUpdates.length === 0) {
      return [];
    }

    // Apply updates in chronological order
    const appliedUpdates = [];
    for (const update of pendingUpdates) {
      try {
        const { error } = await supabase
          .from('internal_messages')
          .update({ delivery_status: update.status })
          .eq('id', update.message_id);

        if (!error) {
          appliedUpdates.push(update);
        }
      } catch (error) {
        console.error(`Failed to apply status update ${update.id}:`, error);
      }
    }

    return appliedUpdates;
  } catch (error) {
    console.error('Error syncing pending status updates:', error);
    return [];
  }
}
