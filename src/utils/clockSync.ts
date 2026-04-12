// STEP 81: CLOCK SYNC DRIFT FIX - Sync client time with server, prevent wrong message order
export interface ClockSyncInfo {
  serverTime: number;
  clientTime: number;
  drift: number;
  rtt: number;
  lastSync: number;
}

export class ClockSyncManager {
  private static instance: ClockSyncManager;
  private syncInfo: ClockSyncInfo | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private maxDrift = 5000; // 5 seconds max acceptable drift
  private syncFrequency = 30000; // Sync every 30 seconds

  static getInstance(): ClockSyncManager {
    if (!ClockSyncManager.instance) {
      ClockSyncManager.instance = new ClockSyncManager();
    }
    return ClockSyncManager.instance;
  }

  constructor() {
    this.loadStoredSync();
    this.startPeriodicSync();
  }

  private loadStoredSync() {
    try {
      const stored = localStorage.getItem('clock_sync');
      if (stored) {
        this.syncInfo = JSON.parse(stored);
        // Check if sync is still valid (within last hour)
        if (Date.now() - this.syncInfo.lastSync > 3600000) {
          this.syncInfo = null;
        }
      }
    } catch (error) {
      console.error('Failed to load clock sync:', error);
    }
  }

  private storeSync() {
    if (this.syncInfo) {
      localStorage.setItem('clock_sync', JSON.stringify(this.syncInfo));
    }
  }

  async syncWithServer(): Promise<boolean> {
    try {
      const clientStartTime = Date.now();
      
      const response = await fetch('/api/time/sync', {
        method: 'GET',
        headers: {
          'X-Client-Time': clientStartTime.toString()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to sync time with server');
      }

      const clientEndTime = Date.now();
      const rtt = clientEndTime - clientStartTime;
      
      const serverData = await response.json();
      const serverTime = serverData.serverTime;
      
      // Calculate drift (server time - estimated client time)
      const estimatedClientTime = clientStartTime + (rtt / 2);
      const drift = serverTime - estimatedClientTime;

      this.syncInfo = {
        serverTime,
        clientTime: estimatedClientTime,
        drift,
        rtt,
        lastSync: Date.now()
      };

      this.storeSync();
      
      console.log(`Clock sync completed: drift=${drift}ms, rtt=${rtt}ms`);
      
      // If drift is too large, warn user
      if (Math.abs(drift) > this.maxDrift) {
        console.warn(`Large clock drift detected: ${drift}ms`);
        this.handleLargeDrift(drift);
      }

      return true;
    } catch (error) {
      console.error('Clock sync failed:', error);
      return false;
    }
  }

  private handleLargeDrift(drift: number) {
    // Store warning for UI to display
    localStorage.setItem('clock_drift_warning', JSON.stringify({
      drift,
      timestamp: Date.now(),
      message: 'Your device clock may be incorrect. Message order might be affected.'
    }));
  }

  // Get server-adjusted timestamp
  getServerTime(): number {
    if (!this.syncInfo) {
      return Date.now(); // Fallback to client time
    }
    
    const now = Date.now();
    const timeSinceSync = now - this.syncInfo.lastSync;
    
    // Adjust for drift and time since sync
    return now + this.syncInfo.drift;
  }

  // Convert client timestamp to server time
  clientToServerTime(clientTime: number): number {
    if (!this.syncInfo) {
      return clientTime;
    }
    
    return clientTime + this.syncInfo.drift;
  }

  // Convert server timestamp to client time
  serverToClientTime(serverTime: number): number {
    if (!this.syncInfo) {
      return serverTime;
    }
    
    return serverTime - this.syncInfo.drift;
  }

  // Check if sync is valid
  isSyncValid(): boolean {
    if (!this.syncInfo) return false;
    
    // Sync is valid for 5 minutes
    return Date.now() - this.syncInfo.lastSync < 300000;
  }

  // Get sync status
  getSyncStatus(): {
    synced: boolean;
    drift: number;
    rtt: number;
    lastSync: number;
  } {
    if (!this.syncInfo) {
      return {
        synced: false,
        drift: 0,
        rtt: 0,
        lastSync: 0
      };
    }

    return {
      synced: this.isSyncValid(),
      drift: this.syncInfo.drift,
      rtt: this.syncInfo.rtt,
      lastSync: this.syncInfo.lastSync
    };
  }

  // Start periodic sync
  private startPeriodicSync() {
    // Initial sync
    this.syncWithServer();
    
    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.syncWithServer();
    }, this.syncFrequency);
  }

  // Stop periodic sync
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Force immediate sync
  async forceSync(): Promise<boolean> {
    return await this.syncWithServer();
  }

  // Get drift warning
  getDriftWarning(): { drift: number; message: string; timestamp: number } | null {
    try {
      const warning = localStorage.getItem('clock_drift_warning');
      if (warning) {
        const parsed = JSON.parse(warning);
        // Only show warning if it's recent (last 10 minutes)
        if (Date.now() - parsed.timestamp < 600000) {
          return parsed;
        } else {
          localStorage.removeItem('clock_drift_warning');
        }
      }
    } catch (error) {
      console.error('Failed to get drift warning:', error);
    }
    return null;
  }

  // Clear drift warning
  clearDriftWarning() {
    localStorage.removeItem('clock_drift_warning');
  }

  // Validate timestamp ordering
  validateTimestampOrder(timestamps: number[]): boolean {
    if (!this.syncInfo) return true; // Can't validate without sync
    
    // Convert all timestamps to server time and check if they're in order
    const serverTimestamps = timestamps.map(ts => this.clientToServerTime(ts));
    
    for (let i = 1; i < serverTimestamps.length; i++) {
      if (serverTimestamps[i] < serverTimestamps[i - 1]) {
        console.warn('Timestamp order validation failed:', {
          original: timestamps,
          server: serverTimestamps,
          drift: this.syncInfo.drift
        });
        return false;
      }
    }
    
    return true;
  }

  // Get adjusted timestamp for new message
  getAdjustedTimestamp(): number {
    const serverTime = this.getServerTime();
    
    // Add small random offset to prevent exact same timestamps
    // This helps with message ordering when multiple messages are sent quickly
    const randomOffset = Math.random() * 10; // 0-10ms random offset
    
    return serverTime + randomOffset;
  }

  // Cleanup
  destroy() {
    this.stopPeriodicSync();
  }
}

export const clockSyncManager = ClockSyncManager.getInstance();
