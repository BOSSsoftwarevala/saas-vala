// STEP 87: SOCKET REUSE - Avoid multiple socket instances, single connection per session
import { RealtimeChannel, RealtimeClient } from '@supabase/supabase-js';

export interface SocketConfig {
  url: string;
  apiKey: string;
  options?: {
    reconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  };
}

export interface SocketStats {
  isConnected: boolean;
  connectionCount: number;
  reconnectAttempts: number;
  lastConnected: number | null;
  lastDisconnected: number | null;
  totalUptime: number;
  channelsCount: number;
}

export class SocketReuseManager {
  private static instance: SocketReuseManager;
  private client: RealtimeClient | null = null;
  private channels = new Map<string, RealtimeChannel>();
  private config: SocketConfig | null = null;
  private connectionPromise: Promise<RealtimeClient> | null = null;
  private stats: SocketStats = {
    isConnected: false,
    connectionCount: 0,
    reconnectAttempts: 0,
    lastConnected: null,
    lastDisconnected: null,
    totalUptime: 0,
    channelsCount: 0
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private uptimeTimer: NodeJS.Timeout | null = null;

  static getInstance(): SocketReuseManager {
    if (!SocketReuseManager.instance) {
      SocketReuseManager.instance = new SocketReuseManager();
    }
    return SocketReuseManager.instance;
  }

  // Initialize socket connection
  async connect(config: SocketConfig): Promise<RealtimeClient> {
    // Return existing connection if already connected with same config
    if (this.client && this.config && this.isSameConfig(config, this.config)) {
      if (this.stats.isConnected) {
        return this.client;
      }
      // If not connected, wait for connection
      return this.connectionPromise || this.reconnect();
    }

    // New config, disconnect existing and create new
    if (this.client) {
      await this.disconnect();
    }

    this.config = config;
    this.connectionPromise = this.createConnection(config);
    
    return this.connectionPromise;
  }

  private isSameConfig(config1: SocketConfig, config2: SocketConfig): boolean {
    return config1.url === config2.url && config1.apiKey === config2.apiKey;
  }

  private async createConnection(config: SocketConfig): Promise<RealtimeClient> {
    try {
      console.log('Creating new socket connection...');
      
      this.client = new RealtimeClient(config.url, {
        apiKey: config.apiKey,
        ...config.options
      });

      // Set up connection event handlers
      this.setupEventHandlers();

      // Connect to realtime
      await this.client.connect();

      this.updateConnectionStats(true);
      console.log('Socket connection established');

      return this.client;
    } catch (error) {
      console.error('Failed to create socket connection:', error);
      this.updateConnectionStats(false);
      throw error;
    }
  }

  private setupEventHandlers() {
    if (!this.client) return;

    this.client.onOpen(() => {
      console.log('Socket connection opened');
      this.updateConnectionStats(true);
      this.stats.reconnectAttempts = 0;
      this.startUptimeTimer();
    });

    this.client.onClose(() => {
      console.log('Socket connection closed');
      this.updateConnectionStats(false);
      this.stopUptimeTimer();
      this.scheduleReconnect();
    });

    this.client.onError((error) => {
      console.error('Socket connection error:', error);
      this.updateConnectionStats(false);
    });
  }

  private updateConnectionStats(connected: boolean) {
    const now = Date.now();
    
    if (connected) {
      this.stats.isConnected = true;
      this.stats.lastConnected = now;
      this.stats.connectionCount++;
    } else {
      this.stats.isConnected = false;
      this.stats.lastDisconnected = now;
    }

    this.stats.channelsCount = this.channels.size;
  }

  private startUptimeTimer() {
    this.stopUptimeTimer();
    this.uptimeTimer = setInterval(() => {
      if (this.stats.isConnected) {
        this.stats.totalUptime++;
      }
    }, 1000);
  }

  private stopUptimeTimer() {
    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer);
      this.uptimeTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const maxAttempts = this.config?.options?.maxReconnectAttempts || 5;
    const baseInterval = this.config?.options?.reconnectInterval || 2000;

    if (this.stats.reconnectAttempts < maxAttempts) {
      const delay = baseInterval * Math.pow(2, this.stats.reconnectAttempts); // Exponential backoff
      
      console.log(`Scheduling reconnect attempt ${this.stats.reconnectAttempts + 1}/${maxAttempts} in ${delay}ms`);
      
      this.reconnectTimer = setTimeout(() => {
        this.reconnect();
      }, delay);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  private async reconnect(): Promise<RealtimeClient> {
    if (!this.config) {
      throw new Error('No configuration available for reconnection');
    }

    this.stats.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.stats.reconnectAttempts})`);

    try {
      if (this.client) {
        await this.client.disconnect();
      }
      
      this.connectionPromise = this.createConnection(this.config);
      return this.connectionPromise;
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  // Get or create channel (reuses existing if available)
  getChannel(channelName: string): RealtimeChannel {
    if (!this.client) {
      throw new Error('Socket not connected. Call connect() first.');
    }

    // Return existing channel if available
    if (this.channels.has(channelName)) {
      const channel = this.channels.get(channelName)!;
      
      // Check if channel is still active
      if (channel.state === 'joined' || channel.state === 'joining') {
        return channel;
      }
      
      // Remove inactive channel
      this.channels.delete(channelName);
    }

    // Create new channel
    const channel = this.client.channel(channelName);
    this.channels.set(channelName, channel);
    this.stats.channelsCount = this.channels.size;

    // Set up channel cleanup on unsubscribe
    channel.onClose(() => {
      this.channels.delete(channelName);
      this.stats.channelsCount = this.channels.size;
    });

    return channel;
  }

  // Remove channel
  async removeChannel(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName);
    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(channelName);
      this.stats.channelsCount = this.channels.size;
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.stats.isConnected && this.client !== null;
  }

  // Get socket statistics
  getStats(): SocketStats {
    return { ...this.stats };
  }

  // Force disconnect
  async disconnect(): Promise<void> {
    console.log('Disconnecting socket...');

    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopUptimeTimer();

    // Unsubscribe all channels
    const channelPromises = Array.from(this.channels.values()).map(channel => 
      channel.unsubscribe().catch(error => 
        console.error('Failed to unsubscribe channel:', error)
      )
    );

    await Promise.allSettled(channelPromises);
    this.channels.clear();

    // Disconnect client
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    this.updateConnectionStats(false);
    this.connectionPromise = null;
    this.config = null;

    console.log('Socket disconnected');
  }

  // Ping server to check connection health
  async ping(): Promise<boolean> {
    if (!this.client || !this.stats.isConnected) {
      return false;
    }

    try {
      const startTime = Date.now();
      
      // Create a temporary channel for ping
      const pingChannel = this.client.channel('ping');
      await pingChannel.subscribe();
      
      const responseTime = Date.now() - startTime;
      
      // Clean up ping channel
      await pingChannel.unsubscribe();
      
      console.log(`Ping successful: ${responseTime}ms`);
      return true;
    } catch (error) {
      console.error('Ping failed:', error);
      return false;
    }
  }

  // Get connection health status
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'disconnected';
    uptime: number;
    reconnectRate: number;
    channelCount: number;
  } {
    const now = Date.now();
    const uptime = this.stats.lastConnected ? now - this.stats.lastConnected : 0;
    const reconnectRate = this.stats.connectionCount > 1 
      ? this.stats.reconnectAttempts / (this.stats.connectionCount - 1) 
      : 0;

    let status: 'healthy' | 'degraded' | 'disconnected';
    
    if (!this.stats.isConnected) {
      status = 'disconnected';
    } else if (reconnectRate > 0.5 || uptime < 60000) { // High reconnect rate or connected less than 1 minute
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      uptime,
      reconnectRate,
      channelCount: this.stats.channelsCount
    };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      isConnected: this.stats.isConnected,
      connectionCount: 0,
      reconnectAttempts: 0,
      lastConnected: this.stats.lastConnected,
      lastDisconnected: this.stats.lastDisconnected,
      totalUptime: 0,
      channelsCount: this.channels.size
    };
  }

  // Get all active channels
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  // Check if specific channel exists
  hasChannel(channelName: string): boolean {
    return this.channels.has(channelName);
  }

  // Cleanup on page unload
  setupCleanupHandlers(): void {
    const cleanup = () => {
      this.disconnect();
    };

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
  }
}

export const socketReuseManager = SocketReuseManager.getInstance();
