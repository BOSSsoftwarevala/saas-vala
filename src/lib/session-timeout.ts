export class SessionTimeout {
  private timeoutDuration: number = 30 * 60 * 1000 // 30 minutes default
  private warningDuration: number = 5 * 60 * 1000 // 5 minutes warning
  private timeoutTimer: NodeJS.Timeout | null = null
  private warningTimer: NodeJS.Timeout | null = null
  private lastActivityTime: number = Date.now()
  private onTimeoutCallback: (() => void) | null = null
  private onWarningCallback: ((remainingTime: number) => void) | null = null
  private onActivityCallback: (() => void) | null = null
  private isActive: boolean = false

  constructor(timeoutMinutes: number = 30) {
    this.timeoutDuration = timeoutMinutes * 60 * 1000
    this.setupActivityListeners()
  }

  // Set timeout callbacks
  setCallbacks(
    onTimeout: () => void,
    onWarning: (remainingTime: number) => void,
    onActivity: () => void
  ) {
    this.onTimeoutCallback = onTimeout
    this.onWarningCallback = onWarning
    this.onActivityCallback = onActivity
  }

  // Start session timeout monitoring
  start() {
    if (this.isActive) return
    
    this.isActive = true
    this.lastActivityTime = Date.now()
    this.startTimers()
    console.log('Session timeout monitoring started')
  }

  // Stop session timeout monitoring
  stop() {
    this.isActive = false
    this.clearTimers()
    console.log('Session timeout monitoring stopped')
  }

  // Reset timeout (call on user activity)
  reset() {
    if (!this.isActive) return
    
    this.lastActivityTime = Date.now()
    this.clearTimers()
    this.startTimers()
    
    if (this.onActivityCallback) {
      this.onActivityCallback()
    }
  }

  // Start timeout and warning timers
  private startTimers() {
    const timeUntilTimeout = this.timeoutDuration
    const timeUntilWarning = timeUntilTimeout - this.warningDuration

    // Warning timer
    if (timeUntilWarning > 0) {
      this.warningTimer = setTimeout(() => {
        if (this.onWarningCallback) {
          this.onWarningCallback(this.warningDuration)
        }
      }, timeUntilWarning)
    }

    // Timeout timer
    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout()
    }, timeUntilTimeout)
  }

  // Clear all timers
  private clearTimers() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer)
      this.warningTimer = null
    }
  }

  // Handle session timeout
  private handleTimeout() {
    console.warn('Session timeout reached')
    this.isActive = false
    
    if (this.onTimeoutCallback) {
      this.onTimeoutCallback()
    }
  }

  // Setup activity listeners
  private setupActivityListeners() {
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ]

    const handleActivity = () => {
      this.reset()
    }

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Store event listeners for cleanup
    this.activityListeners = activityEvents.map(event => ({
      event,
      handler: handleActivity
    }))
  }

  private activityListeners: Array<{event: string, handler: () => void}> = []

  // Get remaining time
  getRemainingTime(): number {
    if (!this.isActive) return 0
    
    const elapsed = Date.now() - this.lastActivityTime
    const remaining = Math.max(0, this.timeoutDuration - elapsed)
    return remaining
  }

  // Get time until warning
  getTimeUntilWarning(): number {
    if (!this.isActive) return 0
    
    const elapsed = Date.now() - this.lastActivityTime
    const timeUntilWarning = this.timeoutDuration - this.warningDuration - elapsed
    return Math.max(0, timeUntilWarning)
  }

  // Check if warning should be shown
  shouldShowWarning(): boolean {
    return this.getTimeUntilWarning() <= 0 && this.getRemainingTime() > 0
  }

  // Extend session
  extendSession(extraMinutes: number = 30) {
    const extraTime = extraMinutes * 60 * 1000
    this.timeoutDuration += extraTime
    this.reset()
    console.log(`Session extended by ${extraMinutes} minutes`)
  }

  // Set custom timeout duration
  setTimeoutDuration(minutes: number) {
    this.timeoutDuration = minutes * 60 * 1000
    if (this.isActive) {
      this.reset()
    }
  }

  // Get timeout status
  getStatus() {
    return {
      isActive: this.isActive,
      remainingTime: this.getRemainingTime(),
      timeUntilWarning: this.getTimeUntilWarning(),
      shouldShowWarning: this.shouldShowWarning(),
      lastActivityTime: this.lastActivityTime,
      timeoutDuration: this.timeoutDuration
    }
  }

  // Force timeout (for testing)
  forceTimeout() {
    this.handleTimeout()
  }

  // Check if session is about to timeout
  isAboutToTimeout(): boolean {
    return this.getRemainingTime() < this.warningDuration
  }

  // Get formatted remaining time
  getFormattedRemainingTime(): string {
    const remaining = this.getRemainingTime()
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Cleanup
  destroy() {
    this.stop()
    
    // Remove event listeners
    this.activityListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler, true)
    })
    this.activityListeners = []
  }
}
