// STEP 56: DEVICE IDENTIFIER - Track which device sent message
export interface DeviceInfo {
  deviceId: string;
  deviceType: 'web' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  screenResolution: string;
  language: string;
  timezone: string;
  lastActive: string;
  isOnline: boolean;
}

export class DeviceManager {
  private static instance: DeviceManager;
  private currentDevice: DeviceInfo | null = null;

  static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager();
    }
    return DeviceManager.instance;
  }

  constructor() {
    this.initializeDevice();
  }

  private initializeDevice() {
    try {
      // Check if device already exists
      const storedDevice = this.getStoredDevice();
      if (storedDevice) {
        this.currentDevice = { ...storedDevice, lastActive: new Date().toISOString(), isOnline: true };
        this.updateStoredDevice();
      } else {
        this.currentDevice = this.createNewDevice();
        this.storeDevice();
      }
    } catch (error) {
      console.error('Failed to initialize device:', error);
      this.currentDevice = this.createFallbackDevice();
    }
  }

  private createNewDevice(): DeviceInfo {
    const deviceId = this.generateDeviceId();
    
    return {
      deviceId,
      deviceType: this.detectDeviceType(),
      browser: this.detectBrowser(),
      os: this.detectOS(),
      screenResolution: `${screen.width}x${screen.height}`,
      language: navigator.language || 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      lastActive: new Date().toISOString(),
      isOnline: navigator.onLine
    };
  }

  private createFallbackDevice(): DeviceInfo {
    return {
      deviceId: this.generateDeviceId(),
      deviceType: 'web',
      browser: 'unknown',
      os: 'unknown',
      screenResolution: 'unknown',
      language: 'en-US',
      timezone: 'UTC',
      lastActive: new Date().toISOString(),
      isOnline: true
    };
  }

  private generateDeviceId(): string {
    // Try to get existing ID from various sources
    let deviceId = localStorage.getItem('device_id');
    
    if (!deviceId) {
      // Generate new ID based on available info
      const fingerprint = this.generateFingerprint();
      deviceId = `device_${fingerprint}_${Date.now()}`;
      localStorage.setItem('device_id', deviceId);
    }
    
    return deviceId;
  }

  private generateFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
      }
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL()
      ].join('|');
      
      return this.simpleHash(fingerprint);
    } catch {
      return Math.random().toString(36).substr(2, 9);
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private detectDeviceType(): 'web' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
        return 'tablet';
      }
      return 'mobile';
    }
    
    return 'web';
  }

  private detectBrowser(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Unknown';
  }

  private detectOS(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('windows')) return 'Windows';
    if (userAgent.includes('mac')) return 'macOS';
    if (userAgent.includes('linux')) return 'Linux';
    if (userAgent.includes('android')) return 'Android';
    if (userAgent.includes('ios') || userAgent.includes('iphone') || userAgent.includes('ipad')) return 'iOS';
    
    return 'Unknown';
  }

  private getStoredDevice(): DeviceInfo | null {
    try {
      const stored = localStorage.getItem('current_device');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private storeDevice() {
    if (this.currentDevice) {
      localStorage.setItem('current_device', JSON.stringify(this.currentDevice));
    }
  }

  private updateStoredDevice() {
    if (this.currentDevice) {
      this.currentDevice.lastActive = new Date().toISOString();
      this.currentDevice.isOnline = navigator.onLine;
      localStorage.setItem('current_device', JSON.stringify(this.currentDevice));
    }
  }

  // Public methods
  getCurrentDevice(): DeviceInfo | null {
    return this.currentDevice;
  }

  getDeviceId(): string {
    return this.currentDevice?.deviceId || 'unknown';
  }

  updateDeviceStatus(isOnline: boolean) {
    if (this.currentDevice) {
      this.currentDevice.isOnline = isOnline;
      this.currentDevice.lastActive = new Date().toISOString();
      this.updateStoredDevice();
    }
  }

  // Register device with server
  async registerDevice(userId: string): Promise<boolean> {
    if (!this.currentDevice) return false;

    try {
      const response = await fetch('/api/device/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          userId,
          deviceInfo: this.currentDevice
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to register device:', error);
      return false;
    }
  }

  // Get all devices for a user
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      const response = await fetch(`/api/device/list?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.devices || [];
      }
    } catch (error) {
      console.error('Failed to get user devices:', error);
    }

    return [];
  }

  // Remove device
  async removeDevice(deviceId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/device/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ deviceId })
      });

      if (response.ok) {
        // If removing current device, clear local storage
        if (deviceId === this.currentDevice?.deviceId) {
          localStorage.removeItem('current_device');
          localStorage.removeItem('device_id');
          this.currentDevice = null;
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to remove device:', error);
    }

    return false;
  }

  private async getAuthToken(): Promise<string> {
    // This would integrate with your auth system
    // For now, return a placeholder
    return localStorage.getItem('auth_token') || '';
  }

  // Format device info for display
  formatDeviceInfo(device: DeviceInfo): string {
    const typeIcon = device.deviceType === 'mobile' ? '📱' : device.deviceType === 'tablet' ? '📱' : '💻';
    const statusIcon = device.isOnline ? '🟢' : '🔴';
    
    return `${typeIcon} ${device.browser} on ${device.os} ${statusIcon}`;
  }

  // Check if device is current device
  isCurrentDevice(deviceId: string): boolean {
    return this.currentDevice?.deviceId === deviceId;
  }

  // Get device age
  getDeviceAge(device: DeviceInfo): string {
    const now = new Date();
    const deviceDate = new Date(device.lastActive);
    const diffMs = now.getTime() - deviceDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  // Setup online/offline listeners
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.updateDeviceStatus(true);
    });

    window.addEventListener('offline', () => {
      this.updateDeviceStatus(false);
    });

    // Update every 5 minutes
    setInterval(() => {
      this.updateStoredDevice();
    }, 5 * 60 * 1000);
  }
}

export const deviceManager = DeviceManager.getInstance();
