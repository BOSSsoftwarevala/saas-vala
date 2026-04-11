export interface MaintenanceMode {
  enabled: boolean;
  startTime?: Date;
  endTime?: Date;
  message?: string;
  allowedUsers: string[];
  allowedIPs: string[];
  bypassKey?: string;
  redirectUrl?: string;
  affectedServices: string[];
}

export interface MaintenanceSchedule {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  services: string[];
  notifyUsers: boolean;
  notificationLeadTime: number; // minutes before start
  recurring?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval?: number; // for recurring every N days/weeks/months
    daysOfWeek?: number[]; // for weekly (0-6, Sunday = 0)
    dayOfMonth?: number; // for monthly
  };
  createdAt: string;
  createdBy: string;
  active: boolean;
}

export interface MaintenanceAlert {
  id: string;
  scheduleId: string;
  type: 'upcoming' | 'started' | 'ended';
  message: string;
  scheduledFor: Date;
  sentAt: Date;
  channels: ('email' | 'sms' | 'push' | 'banner')[];
}

export class MaintenanceManager {
  private static instance: MaintenanceManager;
  private currentMode: MaintenanceMode = {
    enabled: false,
    allowedUsers: [],
    allowedIPs: [],
    affectedServices: [],
  };
  private schedules: Map<string, MaintenanceSchedule> = new Map();
  private alerts: MaintenanceAlert[] = [];
  private checkInterval?: NodeJS.Timeout;

  static getInstance(): MaintenanceManager {
    if (!MaintenanceManager.instance) {
      MaintenanceManager.instance = new MaintenanceManager();
    }
    return MaintenanceManager.instance;
  }

  constructor() {
    this.startScheduler();
    this.loadCurrentMode();
    this.loadSchedules();
  }

  async enableMaintenance(options: {
    message?: string;
    endTime?: Date;
    allowedUsers?: string[];
    allowedIPs?: string[];
    bypassKey?: string;
    redirectUrl?: string;
    services?: string[];
  }): Promise<void> {
    this.currentMode = {
      enabled: true,
      startTime: new Date(),
      endTime: options.endTime,
      message: options.message || 'System is under maintenance. Please try again later.',
      allowedUsers: options.allowedUsers || [],
      allowedIPs: options.allowedIPs || [],
      bypassKey: options.bypassKey,
      redirectUrl: options.redirectUrl,
      affectedServices: options.services || ['all'],
    };

    await this.saveCurrentMode();
    await this.notifyMaintenanceStarted();
  }

  async disableMaintenance(): Promise<void> {
    this.currentMode.enabled = false;
    this.currentMode.endTime = new Date();
    
    await this.saveCurrentMode();
    await this.notifyMaintenanceEnded();
  }

  async scheduleMaintenance(schedule: Omit<MaintenanceSchedule, 'id' | 'createdAt' | 'active'>): Promise<MaintenanceSchedule> {
    const newSchedule: MaintenanceSchedule = {
      ...schedule,
      id: this.generateScheduleId(),
      createdAt: new Date().toISOString(),
      active: true,
    };

    this.schedules.set(newSchedule.id, newSchedule);
    await this.saveScheduleToDB(newSchedule);

    // Schedule notifications
    if (schedule.notifyUsers) {
      this.scheduleNotifications(newSchedule);
    }

    return newSchedule;
  }

  async updateSchedule(id: string, updates: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Maintenance schedule ${id} not found`);
    }

    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(id, updatedSchedule);
    await this.saveScheduleToDB(updatedSchedule);

    return updatedSchedule;
  }

  async cancelSchedule(id: string): Promise<void> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Maintenance schedule ${id} not found`);
    }

    schedule.active = false;
    await this.saveScheduleToDB(schedule);
  }

  isMaintenanceActive(service?: string): boolean {
    if (!this.currentMode.enabled) {
      return false;
    }

    // Check if maintenance has expired
    if (this.currentMode.endTime && new Date() > this.currentMode.endTime) {
      this.currentMode.enabled = false;
      this.saveCurrentMode();
      return false;
    }

    // Check if specific service is affected
    if (service && !this.currentMode.affectedServices.includes('all') && 
        !this.currentMode.affectedServices.includes(service)) {
      return false;
    }

    return true;
  }

  canAccess(userId?: string, userIP?: string, bypassKey?: string): boolean {
    if (!this.currentMode.enabled) {
      return true;
    }

    // Check bypass key
    if (bypassKey && this.currentMode.bypassKey === bypassKey) {
      return true;
    }

    // Check allowed users
    if (userId && this.currentMode.allowedUsers.includes(userId)) {
      return true;
    }

    // Check allowed IPs
    if (userIP && this.currentMode.allowedIPs.includes(userIP)) {
      return true;
    }

    return false;
  }

  getMaintenanceStatus(): MaintenanceMode {
    return { ...this.currentMode };
  }

  async getSchedules(activeOnly?: boolean): Promise<MaintenanceSchedule[]> {
    let schedules = Array.from(this.schedules.values());
    
    if (activeOnly) {
      schedules = schedules.filter(s => s.active);
    }

    // Sort by start time
    schedules.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return schedules;
  }

  async getUpcomingMaintenance(days: number = 7): Promise<MaintenanceSchedule[]> {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const now = new Date();

    return Array.from(this.schedules.values())
      .filter(s => s.active && new Date(s.startTime) > now && new Date(s.startTime) <= cutoff)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async getMaintenanceHistory(limit?: number): Promise<MaintenanceAlert[]> {
    let alerts = [...this.alerts];
    
    // Sort by scheduled date (newest first)
    alerts.sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime());

    if (limit) {
      alerts = alerts.slice(0, limit);
    }

    return alerts;
  }

  // Check if there's scheduled maintenance that might affect the user
  async checkScheduledMaintenance(userId?: string): Promise<MaintenanceSchedule[]> {
    const upcoming = await this.getUpcomingMaintenance();
    
    // Filter out maintenance that doesn't affect the user
    return upcoming.filter(schedule => {
      if (!schedule.notifyUsers) return false;
      // Add more sophisticated user filtering logic here
      return true;
    });
  }

  private startScheduler(): void {
    // Check every minute for scheduled maintenance
    this.checkInterval = setInterval(() => {
      this.checkScheduledMaintenance();
    }, 60000);
  }

  private async checkScheduledMaintenance(): Promise<void> {
    const now = new Date();
    
    for (const schedule of this.schedules.values()) {
      if (!schedule.active) continue;

      const startTime = new Date(schedule.startTime);
      const endTime = new Date(schedule.endTime);

      // Check if maintenance should start
      if (now >= startTime && now < endTime && !this.currentMode.enabled) {
        await this.startScheduledMaintenance(schedule);
      }
      // Check if maintenance should end
      else if (now >= endTime && this.currentMode.enabled) {
        await this.disableMaintenance();
      }
      // Check if we should send upcoming notifications
      else if (now < startTime) {
        const timeUntilStart = startTime.getTime() - now.getTime();
        const notificationTime = schedule.notificationLeadTime * 60 * 1000;
        
        if (timeUntilStart <= notificationTime && timeUntilStart > notificationTime - 60000) {
          await this.sendUpcomingNotification(schedule);
        }
      }
    }
  }

  private async startScheduledMaintenance(schedule: MaintenanceSchedule): Promise<void> {
    await this.enableMaintenance({
      message: `Scheduled maintenance: ${schedule.name}. ${schedule.description}`,
      endTime: new Date(schedule.endTime),
      services: schedule.services,
    });

    await this.createAlert({
      scheduleId: schedule.id,
      type: 'started',
      message: `Maintenance "${schedule.name}" has started`,
      scheduledFor: new Date(schedule.startTime),
      channels: ['banner', 'email'],
    });
  }

  private scheduleNotifications(schedule: MaintenanceSchedule): void {
    const startTime = new Date(schedule.startTime);
    const notificationTime = new Date(startTime.getTime() - schedule.notificationLeadTime * 60 * 1000);
    
    if (notificationTime > new Date()) {
      setTimeout(() => {
        this.sendUpcomingNotification(schedule);
      }, notificationTime.getTime() - Date.now());
    }
  }

  private async sendUpcomingNotification(schedule: MaintenanceSchedule): Promise<void> {
    await this.createAlert({
      scheduleId: schedule.id,
      type: 'upcoming',
      message: `Scheduled maintenance "${schedule.name}" will start in ${schedule.notificationLeadTime} minutes`,
      scheduledFor: new Date(schedule.startTime),
      channels: ['email', 'banner'],
    });
  }

  private async notifyMaintenanceStarted(): Promise<void> {
    // Implement notification logic
    console.log('Maintenance mode enabled');
  }

  private async notifyMaintenanceEnded(): Promise<void> {
    // Implement notification logic
    console.log('Maintenance mode disabled');
  }

  private async createAlert(alert: Omit<MaintenanceAlert, 'id' | 'sentAt'>): Promise<void> {
    const newAlert: MaintenanceAlert = {
      ...alert,
      id: this.generateAlertId(),
      sentAt: new Date(),
    };

    this.alerts.push(newAlert);
    await this.saveAlertToDB(newAlert);

    // Send notifications through appropriate channels
    await this.sendNotifications(newAlert);
  }

  private async sendNotifications(alert: MaintenanceAlert): Promise<void> {
    // Implement notification sending logic
    console.log(`Sending ${alert.type} maintenance notification: ${alert.message}`);
  }

  private generateScheduleId(): string {
    return `maint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveCurrentMode(): Promise<void> {
    // Implement database save logic
  }

  private async loadCurrentMode(): Promise<void> {
    // Implement database load logic
  }

  private async saveScheduleToDB(schedule: MaintenanceSchedule): Promise<void> {
    // Implement database save logic
  }

  private async loadSchedules(): Promise<void> {
    // Implement database load logic
  }

  private async saveAlertToDB(alert: MaintenanceAlert): Promise<void> {
    // Implement database save logic
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Middleware for Express.js (if using)
export function maintenanceMiddleware(service?: string) {
  return async (req: any, res: any, next: any) => {
    const maintenance = MaintenanceManager.getInstance();
    
    if (maintenance.isMaintenanceActive(service)) {
      const canAccess = maintenance.canAccess(
        req.user?.id,
        req.ip,
        req.headers['x-maintenance-bypass']
      );

      if (!canAccess) {
        const status = maintenance.getMaintenanceStatus();
        
        if (status.redirectUrl) {
          return res.redirect(307, status.redirectUrl);
        }

        return res.status(503).json({
          error: 'Service Unavailable',
          message: status.message,
          maintenance: {
            enabled: true,
            endTime: status.endTime,
          },
        });
      }
    }

    next();
  };
}

// Decorator for protecting functions during maintenance
export function requireAvailable(service?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const maintenance = MaintenanceManager.getInstance();
      
      if (maintenance.isMaintenanceActive(service)) {
        throw new Error('Service is currently under maintenance');
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
