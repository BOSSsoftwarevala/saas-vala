import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraSlackSystem } from './slack-system';
import { UltraWebSocketServer } from './websocket-server';
import { UltraAccessControl } from './access-control';
import { UltraFileSystem } from './file-system';
import { UltraNotificationSystem } from './notification-system';
import { UltraSearchSystem } from './search-system';
import { UltraAdminPanel } from './admin-panel';
import { UltraBackupRestore } from './backup-restore';
import { UltraSmartQueue } from './smart-queue';
import { UltraAISupport } from './ai-support';
import { UltraSelfHealing } from './self-healing';
import { UltraSecurityHardening } from './security-hardening';
import { Message, Workspace, Channel, User } from './slack-system';

/**
 * UltraSupportSystem - Main integration class for the Slack-style support system
 * 
 * This class orchestrates all the support system components and provides a unified
 * interface for managing workspaces, channels, messages, users, and all support features.
 */
export class UltraSupportSystem extends EventEmitter {
  private static instance: UltraSupportSystem;
  private logger: UltraLogger;
  private isInitialized: boolean = false;

  // Core system components
  private slackSystem: UltraSlackSystem;
  private webSocketServer: UltraWebSocketServer;
  private accessControl: UltraAccessControl;
  private fileSystem: UltraFileSystem;
  private notificationSystem: UltraNotificationSystem;
  private searchSystem: UltraSearchSystem;
  private adminPanel: UltraAdminPanel;
  private backupRestore: UltraBackupRestore;
  private smartQueue: UltraSmartQueue;
  private aiSupport: UltraAISupport;
  private selfHealing: UltraSelfHealing;
  private securityHardening: UltraSecurityHardening;

  static getInstance(): UltraSupportSystem {
    if (!UltraSupportSystem.instance) {
      UltraSupportSystem.instance = new UltraSupportSystem();
    }
    return UltraSupportSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    
    // Initialize all system components
    this.slackSystem = UltraSlackSystem.getInstance();
    this.webSocketServer = UltraWebSocketServer.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.fileSystem = UltraFileSystem.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.searchSystem = UltraSearchSystem.getInstance();
    this.adminPanel = UltraAdminPanel.getInstance();
    this.backupRestore = UltraBackupRestore.getInstance();
    this.smartQueue = UltraSmartQueue.getInstance();
    this.aiSupport = UltraAISupport.getInstance();
    this.selfHealing = UltraSelfHealing.getInstance();
    this.securityHardening = UltraSecurityHardening.getInstance();
  }

  /**
   * Initialize the complete support system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('support-system', 'Support system already initialized');
      return;
    }

    try {
      this.logger.info('support-system', 'Initializing Ultra Support System...');

      // Set up event listeners between components
      this.setupEventListeners();

      // Set up enhanced event listeners for new components
      this.setupAdvancedEventListeners();

      // Verify all components are healthy
      await this.verifySystemHealth();

      this.isInitialized = true;
      this.logger.info('support-system', 'Ultra Support System initialized successfully');

      this.emit('systemInitialized');

    } catch (error) {
      this.logger.error('support-system', 'Failed to initialize support system', error as Error);
      throw error;
    }
  }

  /**
   * Set up event listeners between system components
   */
  private setupEventListeners(): void {
    // Message events -> Search indexing
    this.slackSystem.on('messageSent', async (message: Message) => {
      await this.searchSystem.indexMessage(message);
      
      // Check for content moderation
      await this.adminPanel.getContentFlag(message);
    });

    // Message events -> File processing
    this.slackSystem.on('messageSent', async (message: Message) => {
      if (message.attachments.length > 0) {
        // Process attachments through file system
        for (const attachment of message.attachments) {
          this.logger.debug('support-system', `Processing attachment: ${attachment.name}`);
        }
      }
    });

    // User events -> Access control updates
    this.slackSystem.on('workspaceCreated', async (workspace: Workspace) => {
      // Set up default access control rules
      await this.setupDefaultAccessRules(workspace.id);
    });

    // Ticket events -> Notifications
    this.slackSystem.on('ticketCreated', async (ticket: any) => {
      if (ticket.assignedTo) {
        await this.notificationSystem.createNotification({
          userId: ticket.assignedTo,
          workspaceId: ticket.workspaceId,
          type: 'ticket',
          title: 'New Ticket Assigned',
          content: `Ticket "${ticket.title}" has been assigned to you`,
          data: { ticketId: ticket.id },
          priority: ticket.priority === 'urgent' ? 'urgent' : 'high'
        });
      }
    });

    // Moderation events -> Notifications
    this.adminPanel.on('actionCreated', async (action: any) => {
      // Notify user of moderation action
      if (action.targetType === 'user') {
        await this.notificationSystem.createNotification({
          userId: action.targetId,
          workspaceId: action.workspaceId,
          type: 'system',
          title: 'Moderation Action',
          content: `A moderation action has been taken: ${action.action}`,
          data: { actionId: action.id, reason: action.reason },
          priority: 'high'
        });
      }
    });

    // Backup events -> Notifications
    this.backupRestore.on('backupCompleted', async (backup: any) => {
      // Notify workspace owner
      const workspace = await this.slackSystem.getWorkspace(backup.workspaceId);
      if (workspace) {
        await this.notificationSystem.createNotification({
          userId: workspace.owner,
          workspaceId: backup.workspaceId,
          type: 'system',
          title: 'Backup Completed',
          content: `Backup completed successfully. Size: ${this.formatBytes(backup.size)}`,
          data: { backupId: backup.id },
          priority: 'low'
        });
      }
    });

    // WebSocket events -> User status updates
    this.webSocketServer.on('userConnected', async (connection: any) => {
      this.logger.debug('support-system', `User connected: ${connection.userId}`);
    });

    this.webSocketServer.on('userDisconnected', async (connection: any) => {
      this.logger.debug('support-system', `User disconnected: ${connection.userId}`);
    });
  }

  /**
   * Set up advanced event listeners for new ultra-advanced components
   */
  private setupAdvancedEventListeners(): void {
    // Smart Queue events
    this.smartQueue.on('itemAddedToQueue', async (item: any) => {
      // Auto-process with AI
      if (item.messageId) {
        const messages = await this.slackSystem.getMessages({
          workspaceId: item.workspaceId,
          messageId: item.messageId
        });
        if (messages.length > 0) {
          await this.aiSupport.processMessage(messages[0], item.userId);
        }
      }
    });

    this.smartQueue.on('itemAssigned', async (data: any) => {
      // Notify assigned agent
      await this.notificationSystem.createNotification({
        userId: data.agent.userId,
        workspaceId: data.item.workspaceId,
        type: 'message',
        title: 'New Assignment',
        content: `You have been assigned to: ${data.item.subject || 'Support Request'}`,
        data: { queueItemId: data.item.id },
        priority: 'high'
      });
    });

    // AI Support events
    this.aiSupport.on('suggestionAccepted', async (data: any) => {
      // Track AI suggestion acceptance for analytics
      this.logger.info('support-system', `AI suggestion accepted: ${data.suggestion.id}`);
    });

    // Self-healing events
    this.selfHealing.on('healthIssueDetected', async (issue: any) => {
      // Notify administrators of critical issues
      if (issue.severity === 'critical') {
        await this.notifyAdministrators(issue);
      }
    });

    this.selfHealing.on('healingActionCompleted', async (action: any) => {
      this.logger.info('support-system', `Healing action completed: ${action.id}`);
    });

    // Security events
    this.securityHardening.on('securityIncident', async (incident: any) => {
      // Handle security incidents
      if (incident.severity === 'critical') {
        await this.notifyAdministrators(incident);
      }
    });

    this.securityHardening.on('ipBlocked', async (data: any) => {
      this.logger.warn('support-system', `IP blocked: ${data.ipAddress}`, {
        reason: data.reason,
        until: data.until
      });
    });
  }

  /**
   * Set up default access control rules for new workspaces
   */
  private async setupDefaultAccessRules(workspaceId: string): Promise<void> {
    try {
      // Create default access rules
      await this.accessControl.createAccessRule(workspaceId, {
        resource: '*',
        action: '*',
        conditions: [{
          type: 'user_role',
          operator: 'equals',
          value: 'super_admin'
        }],
        effect: 'allow',
        priority: 100
      });

      await this.accessControl.createAccessRule(workspaceId, {
        resource: 'messages',
        action: 'send',
        conditions: [{
          type: 'user_role',
          operator: 'in',
          value: ['admin', 'support_agent', 'reseller', 'customer']
        }],
        effect: 'allow',
        priority: 50
      });

      this.logger.info('support-system', `Default access rules created for workspace: ${workspaceId}`);

    } catch (error) {
      this.logger.error('support-system', `Failed to setup default access rules: ${workspaceId}`, error as Error);
    }
  }

  /**
   * Verify all system components are healthy
   */
  private async verifySystemHealth(): Promise<void> {
    const healthChecks = await Promise.allSettled([
      this.slackSystem.healthCheck(),
      this.webSocketServer.healthCheck(),
      this.accessControl.healthCheck(),
      this.fileSystem.healthCheck(),
      this.notificationSystem.healthCheck(),
      this.searchSystem.healthCheck(),
      this.adminPanel.healthCheck(),
      this.backupRestore.healthCheck()
    ]);

    for (const [index, check] of healthChecks.entries()) {
      if (check.status === 'rejected') {
        const componentNames = [
          'Slack System', 'WebSocket Server', 'Access Control',
          'File System', 'Notification System', 'Search System',
          'Admin Panel', 'Backup & Restore'
        ];
        this.logger.error('support-system', `Health check failed: ${componentNames[index]}`, check.reason);
      }
    }
  }

  // WORKSPACE MANAGEMENT
  async createWorkspace(config: {
    name: string;
    domain: string;
    description?: string;
    logo?: string;
    plan?: string;
    owner: string;
    settings?: any;
  }): Promise<string> {
    return await this.slackSystem.createWorkspace(config);
  }

  async getWorkspace(workspaceId: string): Promise<any> {
    return await this.slackSystem.getWorkspace(workspaceId);
  }

  async getWorkspaceByDomain(domain: string): Promise<any> {
    return await this.slackSystem.getWorkspaceByDomain(domain);
  }

  // CHANNEL MANAGEMENT
  async createChannel(workspaceId: string, config: {
    name: string;
    type: string;
    description?: string;
    purpose?: string;
    createdBy: string;
  }): Promise<string> {
    return await this.slackSystem.createChannel(workspaceId, config);
  }

  async getChannel(channelId: string): Promise<any> {
    return await this.slackSystem.getChannel(channelId);
  }

  async getChannelsByWorkspace(workspaceId: string, userId?: string): Promise<any[]> {
    return await this.slackSystem.getChannelsByWorkspace(workspaceId, userId);
  }

  // MESSAGE MANAGEMENT
  async sendMessage(config: {
    workspaceId: string;
    channelId?: string;
    dmId?: string;
    senderId: string;
    type: string;
    content: string;
    threadId?: string;
    attachments?: any[];
    mentions?: any[];
  }): Promise<string> {
    // Check permissions before sending
    const hasPermission = await this.accessControl.canAccessResource(
      config.senderId,
      config.workspaceId,
      'messages',
      'send'
    );

    if (!hasPermission) {
      throw new Error('Insufficient permissions to send message');
    }

    return await this.slackSystem.sendMessage(config);
  }

  async getMessages(config: {
    workspaceId: string;
    channelId?: string;
    dmId?: string;
    threadId?: string;
    limit?: number;
    before?: string;
    after?: string;
  }): Promise<any[]> {
    return await this.slackSystem.getMessages(config);
  }

  // DIRECT MESSAGING
  async createDirectMessage(workspaceId: string, participants: string[], createdBy: string): Promise<string> {
    return await this.slackSystem.createDirectMessage(workspaceId, participants, createdBy);
  }

  async getDirectMessage(dmId: string): Promise<any> {
    return await this.slackSystem.getDirectMessage(dmId);
  }

  async getDirectMessagesByUser(workspaceId: string, userId: string): Promise<any[]> {
    return await this.slackSystem.getDirectMessagesByUser(workspaceId, userId);
  }

  // THREAD MANAGEMENT
  async createThread(messageId: string): Promise<string> {
    return await this.slackSystem.createThread(messageId);
  }

  async getThread(threadId: string): Promise<any> {
    return await this.slackSystem.getThread(threadId);
  }

  // TICKET MANAGEMENT
  async createTicket(config: {
    workspaceId: string;
    messageId: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    createdBy: string;
    tags?: string[];
  }): Promise<string> {
    return await this.slackSystem.createTicket(config);
  }

  async getTicket(ticketId: string): Promise<any> {
    return await this.slackSystem.getTicket(ticketId);
  }

  async getTicketsByWorkspace(workspaceId: string, filters?: any): Promise<any[]> {
    return await this.slackSystem.getTicketsByWorkspace(workspaceId, filters);
  }

  // SEARCH SYSTEM
  async searchMessages(query: {
    workspaceId: string;
    userId: string;
    query: string;
    filters?: any;
    sort?: any;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    // Check search permissions
    const hasPermission = await this.accessControl.canAccessResource(
      query.userId,
      query.workspaceId,
      'messages',
      'read'
    );

    if (!hasPermission) {
      throw new Error('Insufficient permissions to search messages');
    }

    return await this.searchSystem.search(query);
  }

  // FILE MANAGEMENT
  async uploadFile(config: {
    workspaceId: string;
    userId: string;
    messageId?: string;
    channelId?: string;
    dmId?: string;
    file: any;
    isPublic?: boolean;
    expiresAt?: Date;
  }): Promise<string> {
    // Check upload permissions
    const hasPermission = await this.accessControl.canAccessResource(
      config.userId,
      config.workspaceId,
      'files',
      'upload'
    );

    if (!hasPermission) {
      throw new Error('Insufficient permissions to upload files');
    }

    return await this.fileSystem.uploadFile(config);
  }

  async downloadFile(fileId: string, userId?: string, ipAddress?: string, userAgent?: string): Promise<any> {
    return await this.fileSystem.downloadFile(fileId, userId, ipAddress, userAgent);
  }

  async getFile(fileId: string): Promise<any> {
    return await this.fileSystem.getFile(fileId);
  }

  async getFilesByWorkspace(workspaceId: string, filters?: any): Promise<any[]> {
    return await this.fileSystem.getFilesByWorkspace(workspaceId, filters);
  }

  // NOTIFICATION MANAGEMENT
  async createNotification(config: {
    userId: string;
    workspaceId: string;
    type: string;
    title: string;
    content: string;
    data: any;
    priority?: string;
    channels?: any;
  }): Promise<string> {
    return await this.notificationSystem.createNotification(config);
  }

  async getUserNotifications(userId: string, workspaceId: string, filters?: any): Promise<any[]> {
    return await this.notificationSystem.getUserNotifications(userId, workspaceId, filters);
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    return await this.notificationSystem.markAsRead(notificationId, userId);
  }

  // ACCESS CONTROL
  async checkAccess(userId: string, workspaceId: string, resource: string, action: string, context?: any): Promise<boolean> {
    return await this.accessControl.canAccessResource(userId, workspaceId, resource, action, context);
  }

  async createRole(workspaceId: string, config: {
    name: string;
    displayName: string;
    description: string;
    level: number;
    permissions: any[];
  }): Promise<string> {
    return await this.accessControl.createRole(workspaceId, config);
  }

  async getUserPermissions(userId: string, workspaceId: string): Promise<any[]> {
    return await this.accessControl.getUserPermissions(userId, workspaceId);
  }

  // MODERATION
  async createModerationAction(config: {
    workspaceId: string;
    targetId: string;
    targetType: string;
    action: string;
    reason: string;
    moderatorId: string;
    moderatorNote?: string;
    duration?: number;
  }): Promise<string> {
    return await this.adminPanel.createModerationAction(config);
  }

  async createModerationReport(config: {
    workspaceId: string;
    reporterId: string;
    targetId: string;
    targetType: string;
    reason: string;
    description?: string;
  }): Promise<string> {
    return await this.adminPanel.createModerationReport(config);
  }

  async getModerationQueue(workspaceId: string, filters?: any): Promise<any[]> {
    return await this.adminPanel.getModerationQueue(workspaceId, filters);
  }

  // BACKUP & RESTORE
  async createBackup(workspaceId: string, configId?: string, type?: string, createdBy?: string): Promise<string> {
    return await this.backupRestore.createBackup(workspaceId, configId, type, createdBy);
  }

  async getBackups(workspaceId: string, filters?: any): Promise<any[]> {
    return await this.backupRestore.getBackups(workspaceId, filters);
  }

  async createRestoreJob(config: {
    workspaceId: string;
    backupId: string;
    type: string;
    options: any;
    conflicts: string;
    createdBy: string;
  }): Promise<string> {
    return await this.backupRestore.createRestoreJob(config);
  }

  async startRestoreJob(jobId: string): Promise<void> {
    return await this.backupRestore.startRestoreJob(jobId);
  }

  // ANALYTICS & STATS
  async getWorkspaceStats(workspaceId: string): Promise<any> {
    return await this.slackSystem.getStats(workspaceId);
  }

  async getFileStats(workspaceId: string): Promise<any> {
    return await this.fileSystem.getFileStats(workspaceId);
  }

  async getNotificationStats(workspaceId: string, dateRange?: any): Promise<any> {
    return await this.notificationSystem.getNotificationStats(workspaceId, dateRange);
  }

  async getSearchAnalytics(workspaceId: string, dateRange?: any): Promise<any[]> {
    return await this.searchSystem.getSearchAnalytics(workspaceId, dateRange);
  }

  async getModerationStats(workspaceId: string, dateRange?: any): Promise<any[]> {
    return await this.adminPanel.getModerationStats(workspaceId, dateRange);
  }

  async getBackupAnalytics(workspaceId: string, dateRange?: any): Promise<any[]> {
    return await this.backupRestore.getBackupAnalytics(workspaceId, dateRange);
  }

  // SYSTEM HEALTH
  async getSystemHealth(): Promise<{
    healthy: boolean;
    components: any;
    issues: string[];
  }> {
    const healthChecks = await Promise.allSettled([
      this.slackSystem.healthCheck(),
      this.webSocketServer.healthCheck(),
      this.accessControl.healthCheck(),
      this.fileSystem.healthCheck(),
      this.notificationSystem.healthCheck(),
      this.searchSystem.healthCheck(),
      this.adminPanel.healthCheck(),
      this.backupRestore.healthCheck(),
      this.smartQueue.healthCheck(),
      this.aiSupport.healthCheck(),
      this.selfHealing.healthCheck(),
      this.securityHardening.healthCheck()
    ]);

    const componentNames = [
      'Slack System', 'WebSocket Server', 'Access Control',
      'File System', 'Notification System', 'Search System',
      'Admin Panel', 'Backup & Restore', 'Smart Queue',
      'AI Support', 'Self-Healing', 'Security Hardening'
    ];

    let allHealthy = true;
    const componentHealth: any = {};
    const allIssues: string[] = [];

    healthChecks.forEach((result, index) => {
      const name = componentNames[index];
      if (result.status === 'fulfilled') {
        componentHealth[name] = result.value;
        if (!result.value.healthy) {
          allHealthy = false;
          allIssues.push(...(result.value.issues || []));
        }
      } else {
        componentHealth[name] = { healthy: false, error: result.reason };
        allHealthy = false;
        allIssues.push(`${name}: Initialization failed`);
      }
    });

    return {
      healthy: allHealthy,
      components: componentHealth,
      issues: allIssues
    };
  }

  // UTILITY METHODS
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // WebSocket file upload configuration
  getMulterConfig(): any {
    return this.fileSystem.getMulterConfig();
  }

  // Helper method to notify administrators
  private async notifyAdministrators(data: any): Promise<void> {
    try {
      // Get all super admin users
      const admins = await this.database.query(
        'SELECT user_id FROM workspace_members WHERE role = \'super_admin\''
      );
      
      for (const admin of admins.rows) {
        await this.notificationSystem.createNotification({
          userId: admin.user_id,
          workspaceId: 'system',
          type: 'system',
          title: 'System Alert',
          content: `Critical system issue: ${data.description || data.message || 'Unknown issue'}`,
          data,
          priority: 'urgent'
        });
      }
    } catch (error) {
      this.logger.error('support-system', 'Failed to notify administrators', error as Error);
    }
  }

  // Shutdown
  async destroy(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.logger.info('support-system', 'Shutting down Ultra Support System...');

      await Promise.allSettled([
        this.slackSystem.destroy(),
        this.webSocketServer.destroy(),
        this.accessControl.destroy(),
        this.fileSystem.destroy(),
        this.notificationSystem.destroy(),
        this.searchSystem.destroy(),
        this.adminPanel.destroy(),
        this.backupRestore.destroy(),
        this.smartQueue.destroy(),
        this.aiSupport.destroy(),
        this.selfHealing.destroy(),
        this.securityHardening.destroy()
      ]);

      this.isInitialized = false;
      this.logger.info('support-system', 'Ultra Support System shut down successfully');

    } catch (error) {
      this.logger.error('support-system', 'Error during shutdown', error as Error);
    }
  }
}

// Export all components for individual use
export {
  UltraSlackSystem,
  UltraWebSocketServer,
  UltraAccessControl,
  UltraFileSystem,
  UltraNotificationSystem,
  UltraSearchSystem,
  UltraAdminPanel,
  UltraBackupRestore
};

// Export types
export * from './slack-system';
export * from './websocket-server';
export * from './access-control';
export * from './file-system';
export * from './notification-system';
export * from './search-system';
export * from './admin-panel';
export * from './backup-restore';
export * from './smart-queue';
export * from './ai-support';
export * from './self-healing';
export * from './security-hardening';

// Main export
export default UltraSupportSystem;
