// STEP 82: MESSAGE GAP DETECTION - Detect missing sequence, auto refetch gap messages
export interface MessageGap {
  startSequence: number;
  endSequence: number;
  missingCount: number;
  detectedAt: number;
}

export interface MessageWithSequence {
  id: string;
  sequence: number;
  created_at: string;
  chat_id: string;
}

export class MessageGapDetector {
  private static instance: MessageGapDetector;
  private expectedSequences = new Map<string, number>(); // chat_id -> next expected sequence
  private detectedGaps = new Map<string, MessageGap[]>(); // chat_id -> gaps
  private gapRefetchInProgress = new Set<string>(); // chat_ids currently refetching

  static getInstance(): MessageGapDetector {
    if (!MessageGapDetector.instance) {
      MessageGapDetector.instance = new MessageGapDetector();
    }
    return MessageGapDetector.instance;
  }

  // Process incoming messages and detect gaps
  processMessages(chatId: string, messages: MessageWithSequence[]): MessageGap[] {
    if (!messages || messages.length === 0) return [];

    // Sort messages by sequence
    const sortedMessages = messages.sort((a, b) => a.sequence - b.sequence);
    const gaps: MessageGap[] = [];

    // Get expected sequence for this chat
    let expectedSequence = this.expectedSequences.get(chatId) || 1;

    for (const message of sortedMessages) {
      // Check if there's a gap
      if (message.sequence > expectedSequence) {
        const gap: MessageGap = {
          startSequence: expectedSequence,
          endSequence: message.sequence - 1,
          missingCount: message.sequence - expectedSequence,
          detectedAt: Date.now()
        };

        gaps.push(gap);
        
        // Store gap
        if (!this.detectedGaps.has(chatId)) {
          this.detectedGaps.set(chatId, []);
        }
        this.detectedGaps.get(chatId)!.push(gap);

        console.warn(`Message gap detected in chat ${chatId}:`, gap);
      }

      // Update expected sequence
      expectedSequence = message.sequence + 1;
    }

    // Store updated expected sequence
    this.expectedSequences.set(chatId, expectedSequence);

    return gaps;
  }

  // Check for gaps in message timestamps (fallback for sequence-based detection)
  detectTimestampGaps(chatId: string, messages: MessageWithSequence[]): MessageGap[] {
    if (!messages || messages.length < 2) return [];

    const gaps: MessageGap[] = [];
    const sortedMessages = messages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (let i = 1; i < sortedMessages.length; i++) {
      const prevMessage = sortedMessages[i - 1];
      const currentMessage = sortedMessages[i];
      
      const prevTime = new Date(prevMessage.created_at).getTime();
      const currentTime = new Date(currentMessage.created_at).getTime();
      const timeDiff = currentTime - prevTime;

      // If there's a large time gap (> 5 minutes), suspect missing messages
      if (timeDiff > 5 * 60 * 1000) {
        const gap: MessageGap = {
          startSequence: prevMessage.sequence + 1,
          endSequence: currentMessage.sequence - 1,
          missingCount: Math.max(1, Math.floor(timeDiff / (30 * 1000))), // Estimate based on 30s per message
          detectedAt: Date.now()
        };

        gaps.push(gap);
        
        if (!this.detectedGaps.has(chatId)) {
          this.detectedGaps.set(chatId, []);
        }
        this.detectedGaps.get(chatId)!.push(gap);

        console.warn(`Timestamp gap detected in chat ${chatId}:`, gap);
      }
    }

    return gaps;
  }

  // Auto-refetch missing messages for detected gaps
  async refetchGapMessages(
    chatId: string, 
    gap: MessageGap,
    fetchFunction: (startSeq: number, endSeq: number) => Promise<MessageWithSequence[]>
  ): Promise<boolean> {
    if (this.gapRefetchInProgress.has(chatId)) {
      console.log(`Gap refetch already in progress for chat ${chatId}`);
      return false;
    }

    this.gapRefetchInProgress.add(chatId);

    try {
      console.log(`Refetching gap messages for chat ${chatId}:`, gap);
      
      const missingMessages = await fetchFunction(gap.startSequence, gap.endSequence);
      
      if (missingMessages && missingMessages.length > 0) {
        console.log(`Successfully refetched ${missingMessages.length} missing messages`);
        
        // Mark gap as resolved
        this.markGapResolved(chatId, gap);
        return true;
      } else {
        console.warn(`No messages found for gap in chat ${chatId}`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to refetch gap messages for chat ${chatId}:`, error);
      return false;
    } finally {
      this.gapRefetchInProgress.delete(chatId);
    }
  }

  // Refetch all detected gaps for a chat
  async refetchAllGaps(
    chatId: string,
    fetchFunction: (startSeq: number, endSeq: number) => Promise<MessageWithSequence[]>
  ): Promise<number> {
    const gaps = this.detectedGaps.get(chatId) || [];
    if (gaps.length === 0) return 0;

    let successCount = 0;

    for (const gap of gaps) {
      const success = await this.refetchGapMessages(chatId, gap, fetchFunction);
      if (success) successCount++;
    }

    return successCount;
  }

  // Mark a gap as resolved
  private markGapResolved(chatId: string, gap: MessageGap) {
    const chatGaps = this.detectedGaps.get(chatId) || [];
    const index = chatGaps.findIndex(g => 
      g.startSequence === gap.startSequence && 
      g.endSequence === gap.endSequence
    );

    if (index !== -1) {
      chatGaps.splice(index, 1);
      this.detectedGaps.set(chatId, chatGaps);
    }
  }

  // Get all detected gaps for a chat
  getDetectedGaps(chatId: string): MessageGap[] {
    return this.detectedGaps.get(chatId) || [];
  }

  // Get total missing messages count for a chat
  getMissingCount(chatId: string): number {
    const gaps = this.detectedGaps.get(chatId) || [];
    return gaps.reduce((total, gap) => total + gap.missingCount, 0);
  }

  // Check if chat has gaps
  hasGaps(chatId: string): boolean {
    const gaps = this.detectedGaps.get(chatId) || [];
    return gaps.length > 0;
  }

  // Clear gaps for a chat (useful when chat is fully loaded)
  clearGaps(chatId: string) {
    this.detectedGaps.delete(chatId);
    this.expectedSequences.delete(chatId);
  }

  // Reset expected sequence for a chat
  resetExpectedSequence(chatId: string, sequence: number = 1) {
    this.expectedSequences.set(chatId, sequence);
  }

  // Get gap statistics
  getGapStats(chatId: string): {
    totalGaps: number;
    totalMissing: number;
    oldestGap: number | null;
    newestGap: number | null;
  } {
    const gaps = this.detectedGaps.get(chatId) || [];
    
    if (gaps.length === 0) {
      return {
        totalGaps: 0,
        totalMissing: 0,
        oldestGap: null,
        newestGap: null
      };
    }

    const totalMissing = gaps.reduce((sum, gap) => sum + gap.missingCount, 0);
    const oldestGap = Math.min(...gaps.map(g => g.detectedAt));
    const newestGap = Math.max(...gaps.map(g => g.detectedAt));

    return {
      totalGaps: gaps.length,
      totalMissing,
      oldestGap,
      newestGap
    };
  }

  // Validate message sequence continuity
  validateSequenceContinuity(chatId: string, messages: MessageWithSequence[]): {
    isValid: boolean;
    gaps: MessageGap[];
    duplicateSequences: number[];
  } {
    if (!messages || messages.length === 0) {
      return { isValid: true, gaps: [], duplicateSequences: [] };
    }

    const gaps: MessageGap[] = [];
    const duplicateSequences: number[] = [];
    const sequences = new Set<number>();

    // Sort by sequence
    const sortedMessages = messages.sort((a, b) => a.sequence - b.sequence);

    for (let i = 0; i < sortedMessages.length; i++) {
      const message = sortedMessages[i];
      
      // Check for duplicates
      if (sequences.has(message.sequence)) {
        duplicateSequences.push(message.sequence);
      }
      sequences.add(message.sequence);

      // Check for gaps (except first message)
      if (i > 0) {
        const prevMessage = sortedMessages[i - 1];
        if (message.sequence > prevMessage.sequence + 1) {
          gaps.push({
            startSequence: prevMessage.sequence + 1,
            endSequence: message.sequence - 1,
            missingCount: message.sequence - prevMessage.sequence - 1,
            detectedAt: Date.now()
          });
        }
      }
    }

    return {
      isValid: gaps.length === 0 && duplicateSequences.length === 0,
      gaps,
      duplicateSequences
    };
  }

  // Cleanup old gaps (older than 1 hour)
  cleanupOldGaps() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const [chatId, gaps] of this.detectedGaps.entries()) {
      const validGaps = gaps.filter(gap => gap.detectedAt > oneHourAgo);
      
      if (validGaps.length === 0) {
        this.detectedGaps.delete(chatId);
      } else if (validGaps.length < gaps.length) {
        this.detectedGaps.set(chatId, validGaps);
      }
    }
  }

  // Start periodic cleanup
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupOldGaps();
    }, 10 * 60 * 1000); // Every 10 minutes
  }
}

export const messageGapDetector = MessageGapDetector.getInstance();
