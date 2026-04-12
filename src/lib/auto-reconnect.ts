export class AutoReconnectEngine {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // Start with 1 second
  private maxReconnectDelay = 30000 // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null
  private isReconnecting = false
  private onReconnectCallback: (() => Promise<void>) | null = null
  private onReconnectSuccessCallback: (() => void) | null = null
  private onReconnectFailedCallback: (() => void) | null = null

  constructor() {
    // Handle online/offline events
    window.addEventListener('online', this.handleNetworkOnline.bind(this))
    window.addEventListener('offline', this.handleNetworkOffline.bind(this))
  }

  // Set callbacks
  setCallbacks(
    onReconnect: () => Promise<void>,
    onSuccess: () => void,
    onFailed: () => void
  ) {
    this.onReconnectCallback = onReconnect
    this.onReconnectSuccessCallback = onSuccess
    this.onReconnectFailedCallback = onFailed
  }

  // Start auto reconnect process
  startReconnect() {
    if (this.isReconnecting) return

    this.isReconnecting = true
    this.reconnectAttempts = 0
    this.scheduleReconnect()
  }

  // Stop auto reconnect process
  stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.isReconnecting = false
    this.reconnectAttempts = 0
  }

  // Schedule next reconnect attempt
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleReconnectFailed()
      return
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    )

    this.reconnectTimer = setTimeout(async () => {
      await this.attemptReconnect()
    }, delay)
  }

  // Attempt to reconnect
  private async attemptReconnect() {
    if (!this.onReconnectCallback) return

    try {
      this.reconnectAttempts++
      console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      
      await this.onReconnectCallback()
      
      // Reconnect successful
      this.handleReconnectSuccess()
    } catch (error) {
      console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error)
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect()
      } else {
        this.handleReconnectFailed()
      }
    }
  }

  // Handle successful reconnect
  private handleReconnectSuccess() {
    this.stopReconnect()
    if (this.onReconnectSuccessCallback) {
      this.onReconnectSuccessCallback()
    }
  }

  // Handle failed reconnect
  private handleReconnectFailed() {
    this.stopReconnect()
    if (this.onReconnectFailedCallback) {
      this.onReconnectFailedCallback()
    }
  }

  // Handle network online event
  private handleNetworkOnline() {
    if (this.isReconnecting) {
      // Network is back, try immediate reconnect
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
      }
      this.attemptReconnect()
    }
  }

  // Handle network offline event
  private handleNetworkOffline() {
    // Network is down, stop reconnect attempts
    this.stopReconnect()
  }

  // Check if currently reconnecting
  isActive(): boolean {
    return this.isReconnecting
  }

  // Get current reconnect attempt count
  getAttemptCount(): number {
    return this.reconnectAttempts
  }

  // Cleanup
  destroy() {
    this.stopReconnect()
    window.removeEventListener('online', this.handleNetworkOnline.bind(this))
    window.removeEventListener('offline', this.handleNetworkOffline.bind(this))
  }
}
