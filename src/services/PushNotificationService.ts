// STEP 52: PUSH NOTIFICATION FALLBACK - If socket fails, use push notification
export class PushNotificationService {
  private static instance: PushNotificationService;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isSupported = false;
  private permission: NotificationPermission = 'default';

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Check if push notifications are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return false;
      }

      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      this.isSupported = true;

      // Request permission
      this.permission = await Notification.requestPermission();
      
      return this.permission === 'granted';
    } catch (error) {
      console.error('Push notification initialization failed:', error);
      return false;
    }
  }

  async subscribeToPush(): Promise<string | null> {
    if (!this.isSupported || !this.swRegistration || this.permission !== 'granted') {
      return null;
    }

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.VITE_VAPID_PUBLIC_KEY!)
      });

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      return subscription.endpoint;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }

  async showNotification(message: any, chatInfo: any) {
    if (!this.isSupported || this.permission !== 'granted') {
      return;
    }

    try {
      // Show browser notification
      await new Notification(`${chatInfo.name}: ${message.sender.username}`, {
        body: message.message_text.length > 100 
          ? message.message_text.substring(0, 100) + '...' 
          : message.message_text,
        icon: message.sender.avatar_url || '/default-avatar.png',
        badge: '/notification-badge.png',
        tag: `chat-${message.chat_id}`, // Prevent duplicates
        requireInteraction: false,
        actions: [
          {
            action: 'open',
            title: 'Open Chat'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      });

      // Store notification for offline access
      this.storeOfflineNotification(message, chatInfo);
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  private storeOfflineNotification(message: any, chatInfo: any) {
    try {
      const notifications = JSON.parse(localStorage.getItem('offline_notifications') || '[]');
      notifications.push({
        id: `notif-${Date.now()}`,
        message,
        chatInfo,
        timestamp: Date.now(),
        read: false
      });
      
      // Keep only last 50 notifications
      if (notifications.length > 50) {
        notifications.splice(0, notifications.length - 50);
      }
      
      localStorage.setItem('offline_notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to store offline notification:', error);
    }
  }

  getOfflineNotifications(): any[] {
    try {
      return JSON.parse(localStorage.getItem('offline_notifications') || '[]');
    } catch {
      return [];
    }
  }

  markNotificationAsRead(notificationId: string) {
    try {
      const notifications = JSON.parse(localStorage.getItem('offline_notifications') || '[]');
      const notification = notifications.find((n: any) => n.id === notificationId);
      if (notification) {
        notification.read = true;
        localStorage.setItem('offline_notifications', JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Fallback notification when socket fails
  async fallbackNotification(message: any, chatInfo: any) {
    console.log('Using fallback notification system');
    
    // Try multiple notification methods
    await this.showNotification(message, chatInfo);
    
    // Audio notification
    this.playNotificationSound();
    
    // Visual indicator in title
    this.updateTitleIndicator(chatInfo.name);
  }

  private playNotificationSound() {
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors
      });
    } catch {
      // Ignore audio errors
    }
  }

  private updateTitleIndicator(chatName: string) {
    const originalTitle = document.title;
    document.title = `🔔 New message from ${chatName}`;
    
    setTimeout(() => {
      document.title = originalTitle;
    }, 5000);
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
