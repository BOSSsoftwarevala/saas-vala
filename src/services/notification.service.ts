// Notification Service - Consistent toast notifications across the app
import { toast } from 'sonner';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  success(message: string, description?: string): void {
    toast.success(message, {
      description,
      duration: 4000,
      position: 'top-right',
    });
  }

  error(message: string, description?: string): void {
    toast.error(message, {
      description,
      duration: 5000,
      position: 'top-right',
    });
  }

  warning(message: string, description?: string): void {
    toast.warning(message, {
      description,
      duration: 4000,
      position: 'top-right',
    });
  }

  info(message: string, description?: string): void {
    toast(message, {
      description,
      duration: 3000,
      position: 'top-right',
    });
  }

  // Common notification messages
  loginSuccess(): void {
    this.success('Login successful', 'Welcome back!');
  }

  loginFailed(reason?: string): void {
    this.error('Login failed', reason || 'Please check your credentials and try again');
  }

  logoutSuccess(): void {
    this.success('Logged out successfully', 'See you next time!');
  }

  signupSuccess(): void {
    this.success('Account created', 'Please check your email to verify your account');
  }

  signupFailed(reason?: string): void {
    this.error('Account creation failed', reason || 'Please try again later');
  }

  productCreated(name: string): void {
    this.success('Product created', `${name} has been added to the marketplace`);
  }

  productUpdated(name: string): void {
    this.success('Product updated', `${name} has been updated successfully`);
  }

  productDeleted(name: string): void {
    this.success('Product deleted', `${name} has been removed from the marketplace`);
  }

  keyGenerated(): void {
    this.success('Key generated', 'Your new key has been created');
  }

  keyRevoked(): void {
    this.success('Key revoked', 'The key has been revoked successfully');
  }

  orderCreated(): void {
    this.success('Order placed', 'Your order has been processed successfully');
  }

  paymentSuccess(amount: number): void {
    this.success('Payment successful', `$${amount.toFixed(2)} has been charged to your wallet`);
  }

  paymentFailed(reason?: string): void {
    this.error('Payment failed', reason || 'Insufficient funds or payment error');
  }

  walletUpdated(amount: number): void {
    this.success('Wallet updated', `Your new balance is $${amount.toFixed(2)}`);
  }

  walletLocked(): void {
    this.error('Wallet locked', 'Your wallet has been locked due to low balance');
  }

  walletUnlocked(): void {
    this.success('Wallet unlocked', 'Your wallet has been unlocked');
  }

  apkUploaded(version: string): void {
    this.success('APK uploaded', `Version ${version} has been uploaded successfully`);
  }

  apkDeployed(version: string): void {
    this.success('APK deployed', `Version ${version} has been deployed to production`);
  }

  resellerCreated(name: string): void {
    this.success('Reseller created', `${name} has been added as a reseller`);
  }

  resellerUpdated(name: string): void {
    this.success('Reseller updated', `${name} has been updated successfully`);
  }

  ticketCreated(): void {
    this.success('Ticket created', 'Your support ticket has been submitted');
  }

  ticketReplied(): void {
    this.success('Reply sent', 'Your response has been submitted');
  }

  ticketResolved(): void {
    this.success('Ticket resolved', 'The support ticket has been marked as resolved');
  }

  settingsSaved(): void {
    this.success('Settings saved', 'Your changes have been applied');
  }

  networkError(): void {
    this.error('Network error', 'Please check your internet connection and try again');
  }

  serverError(): void {
    this.error('Server error', 'Something went wrong. Please try again later');
  }

  permissionDenied(): void {
    this.error('Access denied', 'You do not have permission to perform this action');
  }

  validationError(message: string): void {
    this.error('Validation error', message);
  }

  loading(message: string): void {
    toast.loading(message, {
      position: 'top-right',
    });
  }

  dismiss(): void {
    toast.dismiss();
  }
}

export const notification = NotificationService.getInstance();

// Convenience functions
export function showSuccess(message: string, description?: string): void {
  notification.success(message, description);
}

export function showError(message: string, description?: string): void {
  notification.error(message, description);
}

export function showWarning(message: string, description?: string): void {
  notification.warning(message, description);
}

export function showInfo(message: string, description?: string): void {
  notification.info(message, description);
}
