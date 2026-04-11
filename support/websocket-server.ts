import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraSlackSystem } from './slack-system';
import * as WebSocket from 'ws';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export interface WebSocketConnection {
  id: string;
  userId: string;
  workspaceId: string;
  socket: WebSocket;
  isAuthenticated: boolean;
  lastPing: Date;
  subscriptions: Set<string>; // channelIds, dmIds
  typingTimeouts: Map<string, NodeJS.Timeout>;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  id?: string;
  timestamp: Date;
}

export interface AuthPayload {
  userId: string;
  workspaceId: string;
  token: string;
}

export class UltraWebSocketServer extends EventEmitter {
  private static instance: UltraWebSocketServer;
  private logger: UltraLogger;
  private slackSystem: UltraSlackSystem;
  private wss: WebSocket.Server;
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private jwtSecret: string;

  static getInstance(): UltraWebSocketServer {
    if (!UltraWebSocketServer.instance) {
      UltraWebSocketServer.instance = new UltraWebSocketServer();
    }
    return UltraWebSocketServer.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.slackSystem = UltraSlackSystem.getInstance();
    this.jwtSecret = process.env.JWT_SECRET || 'ultra-slack-jwt-secret';
    
    this.initialize();
  }

  private initialize(): void {
    try {
      // Create WebSocket server
      this.wss = new WebSocket.Server({
        port: parseInt(process.env.WS_PORT || '8080'),
        verifyClient: this.verifyClient.bind(this)
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleError.bind(this));

      // Start heartbeat
      this.startHeartbeat();

      this.logger.info('websocket-server', 'WebSocket server initialized', {
        port: process.env.WS_PORT || '8080'
      });

    } catch (error) {
      this.logger.error('websocket-server', 'Failed to initialize WebSocket server', error as Error);
      throw error;
    }
  }

  private verifyClient(info: any): boolean {
    try {
      // Get token from query params or headers
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token') || 
                   info.req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('websocket-server', 'Connection rejected: No token provided');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      if (!decoded || !decoded.userId || !decoded.workspaceId) {
        this.logger.warn('websocket-server', 'Connection rejected: Invalid token');
        return false;
      }

      // Attach auth data to request
      (info.req as any).auth = decoded;
      return true;

    } catch (error) {
      this.logger.warn('websocket-server', 'Connection rejected: Token verification failed', error as Error);
      return false;
    }
  }

  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    const auth = req.auth as AuthPayload;
    const connectionId = `conn-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    try {
      const connection: WebSocketConnection = {
        id: connectionId,
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        socket: ws,
        isAuthenticated: true,
        lastPing: new Date(),
        subscriptions: new Set(),
        typingTimeouts: new Map()
      };

      // Store connection
      this.connections.set(connectionId, connection);
      
      // Track user connections
      if (!this.userConnections.has(auth.userId)) {
        this.userConnections.set(auth.userId, new Set());
      }
      this.userConnections.get(auth.userId)!.add(connectionId);

      // Set user online in slack system
      await this.slackSystem.setUserOnline(auth.userId, auth.workspaceId, ws);

      // Setup socket event handlers
      ws.on('message', (data) => this.handleMessage(connectionId, data));
      ws.on('close', () => this.handleClose(connectionId));
      ws.on('error', (error) => this.handleError(connectionId, error));
      ws.on('pong', () => this.handlePong(connectionId));

      // Send welcome message
      this.sendToConnection(connectionId, {
        type: 'connected',
        data: {
          connectionId,
          userId: auth.userId,
          workspaceId: auth.workspaceId,
          timestamp: new Date()
        }
      });

      // Notify other users about online status
      this.broadcastToWorkspace(auth.workspaceId, {
        type: 'user_online',
        data: {
          userId: auth.userId,
          timestamp: new Date()
        }
      }, auth.userId);

      this.logger.info('websocket-server', `User connected: ${auth.userId}`, {
        connectionId,
        workspaceId: auth.workspaceId
      });

      this.emit('userConnected', connection);

    } catch (error) {
      this.logger.error('websocket-server', `Failed to handle connection: ${connectionId}`, error as Error);
      ws.close();
    }
  }

  private async handleMessage(connectionId: string, data: WebSocket.Data): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isAuthenticated) return;

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      // Validate message structure
      if (!message.type || !message.data) {
        this.sendError(connectionId, 'Invalid message format');
        return;
      }

      // Update last activity
      connection.lastPing = new Date();

      // Handle different message types
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(connectionId, message.data);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(connectionId, message.data);
          break;
        case 'send_message':
          await this.handleSendMessage(connectionId, message.data);
          break;
        case 'typing':
          await this.handleTyping(connectionId, message.data);
          break;
        case 'mark_read':
          await this.handleMarkRead(connectionId, message.data);
          break;
        case 'edit_message':
          await this.handleEditMessage(connectionId, message.data);
          break;
        case 'delete_message':
          await this.handleDeleteMessage(connectionId, message.data);
          break;
        case 'add_reaction':
          await this.handleAddReaction(connectionId, message.data);
          break;
        case 'remove_reaction':
          await this.handleRemoveReaction(connectionId, message.data);
          break;
        case 'create_thread':
          await this.handleCreateThread(connectionId, message.data);
          break;
        case 'create_ticket':
          await this.handleCreateTicket(connectionId, message.data);
          break;
        case 'ping':
          this.sendToConnection(connectionId, {
            type: 'pong',
            data: { timestamp: new Date() }
          });
          break;
        default:
          this.sendError(connectionId, `Unknown message type: ${message.type}`);
      }

    } catch (error) {
      this.logger.error('websocket-server', `Failed to handle message: ${connectionId}`, error as Error);
      this.sendError(connectionId, 'Failed to process message');
    }
  }

  private async handleSubscribe(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { channelId, dmId } = data;

    if (channelId) {
      // Verify user has access to channel
      const channel = await this.slackSystem.getChannel(channelId);
      if (!channel || channel.workspaceId !== connection.workspaceId) {
        this.sendError(connectionId, 'Channel not found or access denied');
        return;
      }

      const member = channel.members.find(m => m.userId === connection.userId);
      if (!member && channel.type !== 'public') {
        this.sendError(connectionId, 'Not a member of this channel');
        return;
      }

      connection.subscriptions.add(`channel:${channelId}`);
      
      // Send recent messages for this channel
      const messages = await this.slackSystem.getMessages({
        workspaceId: connection.workspaceId,
        channelId,
        limit: 50
      });

      this.sendToConnection(connectionId, {
        type: 'channel_history',
        data: {
          channelId,
          messages
        }
      });
    }

    if (dmId) {
      // Verify user is participant in DM
      const dm = await this.slackSystem.getDirectMessage(dmId);
      if (!dm || dm.workspaceId !== connection.workspaceId || !dm.participants.includes(connection.userId)) {
        this.sendError(connectionId, 'DM not found or access denied');
        return;
      }

      connection.subscriptions.add(`dm:${dmId}`);
      
      // Send recent messages for this DM
      const messages = await this.slackSystem.getMessages({
        workspaceId: connection.workspaceId,
        dmId,
        limit: 50
      });

      this.sendToConnection(connectionId, {
        type: 'dm_history',
        data: {
          dmId,
          messages
        }
      });
    }

    this.logger.debug('websocket-server', `User subscribed: ${connection.userId}`, {
      connectionId,
      channelId,
      dmId
    });
  }

  private async handleUnsubscribe(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { channelId, dmId } = data;

    if (channelId) {
      connection.subscriptions.delete(`channel:${channelId}`);
    }

    if (dmId) {
      connection.subscriptions.delete(`dm:${dmId}`);
    }

    this.logger.debug('websocket-server', `User unsubscribed: ${connection.userId}`, {
      connectionId,
      channelId,
      dmId
    });
  }

  private async handleSendMessage(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { channelId, dmId, content, type = 'text', attachments, mentions, threadId } = data;

    if (!content && type === 'text') {
      this.sendError(connectionId, 'Message content is required');
      return;
    }

    try {
      const messageId = await this.slackSystem.sendMessage({
        workspaceId: connection.workspaceId,
        channelId,
        dmId,
        senderId: connection.userId,
        type,
        content,
        threadId,
        attachments,
        mentions
      });

      this.sendToConnection(connectionId, {
        type: 'message_sent',
        data: {
          messageId,
          timestamp: new Date()
        }
      });

    } catch (error) {
      this.logger.error('websocket-server', `Failed to send message: ${connectionId}`, error as Error);
      this.sendError(connectionId, 'Failed to send message');
    }
  }

  private async handleTyping(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { channelId, dmId, isTyping } = data;

    // Clear existing timeout
    const existingTimeout = connection.typingTimeouts.get(`${channelId || dmId}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set typing status
    await this.slackSystem.setTypingIndicator({
      userId: connection.userId,
      workspaceId: connection.workspaceId,
      channelId,
      dmId,
      isTyping
    });

    if (isTyping) {
      // Auto-stop typing after 3 seconds
      const timeout = setTimeout(async () => {
        await this.slackSystem.setTypingIndicator({
          userId: connection.userId,
          workspaceId: connection.workspaceId,
          channelId,
          dmId,
          isTyping: false
        });
        connection.typingTimeouts.delete(`${channelId || dmId}`);
      }, 3000);

      connection.typingTimeouts.set(`${channelId || dmId}`, timeout);
    }
  }

  private async handleMarkRead(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { channelId, dmId, messageId } = data;

    // This would update the read status in the database
    // For now, just acknowledge the action
    this.sendToConnection(connectionId, {
      type: 'marked_read',
      data: {
        channelId,
        dmId,
        messageId,
        timestamp: new Date()
      }
    });
  }

  private async handleEditMessage(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId, content } = data;

    if (!content) {
      this.sendError(connectionId, 'Message content is required');
      return;
    }

    // This would update the message in the database
    // For now, just broadcast the edit
    this.broadcastToSubscribers(connectionId, {
      type: 'message_edited',
      data: {
        messageId,
        content,
        editedBy: connection.userId,
        timestamp: new Date()
      }
    });
  }

  private async handleDeleteMessage(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId } = data;

    // This would delete the message in the database
    // For now, just broadcast the deletion
    this.broadcastToSubscribers(connectionId, {
      type: 'message_deleted',
      data: {
        messageId,
        deletedBy: connection.userId,
        timestamp: new Date()
      }
    });
  }

  private async handleAddReaction(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId, emoji } = data;

    // This would add the reaction in the database
    // For now, just broadcast the reaction
    this.broadcastToSubscribers(connectionId, {
      type: 'reaction_added',
      data: {
        messageId,
        emoji,
        userId: connection.userId,
        timestamp: new Date()
      }
    });
  }

  private async handleRemoveReaction(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId, emoji } = data;

    // This would remove the reaction in the database
    // For now, just broadcast the removal
    this.broadcastToSubscribers(connectionId, {
      type: 'reaction_removed',
      data: {
        messageId,
        emoji,
        userId: connection.userId,
        timestamp: new Date()
      }
    });
  }

  private async handleCreateThread(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId } = data;

    try {
      const threadId = await this.slackSystem.createThread(messageId);
      
      this.sendToConnection(connectionId, {
        type: 'thread_created',
        data: {
          messageId,
          threadId,
          timestamp: new Date()
        }
      });

    } catch (error) {
      this.logger.error('websocket-server', `Failed to create thread: ${connectionId}`, error as Error);
      this.sendError(connectionId, 'Failed to create thread');
    }
  }

  private async handleCreateTicket(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId, title, description, category, priority, tags } = data;

    if (!title || !description || !category) {
      this.sendError(connectionId, 'Title, description, and category are required');
      return;
    }

    try {
      const ticketId = await this.slackSystem.createTicket({
        workspaceId: connection.workspaceId,
        messageId,
        title,
        description,
        category,
        priority,
        createdBy: connection.userId,
        tags
      });

      this.sendToConnection(connectionId, {
        type: 'ticket_created',
        data: {
          ticketId,
          messageId,
          timestamp: new Date()
        }
      });

    } catch (error) {
      this.logger.error('websocket-server', `Failed to create ticket: ${connectionId}`, error as Error);
      this.sendError(connectionId, 'Failed to create ticket');
    }
  }

  private handleClose(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Clear typing timeouts
      for (const timeout of connection.typingTimeouts.values()) {
        clearTimeout(timeout);
      }

      // Remove from user connections
      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(connection.userId);
          // Set user offline if no more connections
          this.slackSystem.setUserOffline(connection.userId);
        }
      }

      // Remove connection
      this.connections.delete(connectionId);

      // Notify other users about offline status
      this.broadcastToWorkspace(connection.workspaceId, {
        type: 'user_offline',
        data: {
          userId: connection.userId,
          timestamp: new Date()
        }
      }, connection.userId);

      this.logger.info('websocket-server', `User disconnected: ${connection.userId}`, {
        connectionId
      });

      this.emit('userDisconnected', connection);

    } catch (error) {
      this.logger.error('websocket-server', `Failed to handle close: ${connectionId}`, error as Error);
    }
  }

  private handleError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.logger.error('websocket-server', `WebSocket error: ${connectionId}`, error);
    
    try {
      connection.socket.close();
    } catch (e) {
      // Ignore close errors
    }
  }

  private handlePong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = new Date();
    }
  }

  private startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now - connection.lastPing.getTime() > timeout) {
          this.logger.warn('websocket-server', `Connection timeout: ${connectionId}`);
          connection.socket.terminate();
        } else {
          try {
            connection.socket.ping();
          } catch (error) {
            // Connection might be closed
          }
        }
      }
    }, 15000); // Check every 15 seconds
  }

  // BROADCAST METHODS
  private broadcastToWorkspace(workspaceId: string, message: WebSocketMessage, excludeUserId?: string): void {
    for (const connection of this.connections.values()) {
      if (connection.workspaceId === workspaceId && 
          connection.userId !== excludeUserId &&
          connection.isAuthenticated) {
        this.sendToConnection(connection.id, message);
      }
    }
  }

  private broadcastToSubscribers(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Find the subscription type from the message
    let subscriptionKey: string | null = null;
    
    if (message.data.channelId) {
      subscriptionKey = `channel:${message.data.channelId}`;
    } else if (message.data.dmId) {
      subscriptionKey = `dm:${message.data.dmId}`;
    }

    if (!subscriptionKey) return;

    // Send to all users subscribed to this channel/DM
    for (const conn of this.connections.values()) {
      if (conn.subscriptions.has(subscriptionKey) && 
          conn.isAuthenticated &&
          conn.id !== connectionId) {
        this.sendToConnection(conn.id, message);
      }
    }
  }

  private sendToConnection(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.socket.readyState === WebSocket.OPEN) return;

    try {
      connection.socket.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error('websocket-server', `Failed to send message: ${connectionId}`, error as Error);
    }
  }

  private sendError(connectionId: string, error: string): void {
    this.sendToConnection(connectionId, {
      type: 'error',
      data: { error, timestamp: new Date() }
    });
  }

  // PUBLIC API METHODS
  async broadcastToUser(userId: string, message: WebSocketMessage): Promise<void> {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return;

    for (const connectionId of userConnections) {
      this.sendToConnection(connectionId, message);
    }
  }

  async broadcastToChannel(channelId: string, message: WebSocketMessage): Promise<void> {
    const subscriptionKey = `channel:${channelId}`;
    
    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(subscriptionKey) && connection.isAuthenticated) {
        this.sendToConnection(connection.id, message);
      }
    }
  }

  async broadcastToDM(dmId: string, message: WebSocketMessage): Promise<void> {
    const subscriptionKey = `dm:${dmId}`;
    
    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(subscriptionKey) && connection.isAuthenticated) {
        this.sendToConnection(connection.id, message);
      }
    }
  }

  getConnectionStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    uniqueUsers: number;
    subscriptions: number;
  } {
    const authenticated = Array.from(this.connections.values()).filter(c => c.isAuthenticated).length;
    const subscriptions = Array.from(this.connections.values()).reduce((sum, c) => sum + c.subscriptions.size, 0);

    return {
      totalConnections: this.connections.size,
      authenticatedConnections: authenticated,
      uniqueUsers: this.userConnections.size,
      subscriptions
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    connectionsCount: number;
    activeUsers: number;
    subscriptionsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = this.getConnectionStats();
    
    if (stats.totalConnections > 10000) {
      issues.push('High number of connections');
    }

    return {
      healthy: issues.length === 0,
      connectionsCount: stats.totalConnections,
      activeUsers: stats.uniqueUsers,
      subscriptionsCount: stats.subscriptions,
      issues
    };
  }

  async destroy(): Promise<void> {
    try {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.socket.close();
      }

      // Close WebSocket server
      this.wss.close();

      this.connections.clear();
      this.userConnections.clear();

      this.logger.info('websocket-server', 'WebSocket server shut down');
    } catch (error) {
      this.logger.error('websocket-server', 'Failed to shutdown WebSocket server', error as Error);
    }
  }
}

export default UltraWebSocketServer;
