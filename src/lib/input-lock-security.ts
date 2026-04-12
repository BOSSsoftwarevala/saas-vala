export interface InputLockState {
  mouseLocked: boolean
  keyboardLocked: boolean
  controlEnabled: boolean
}

export class InputLockSecurity {
  private lockState: InputLockState = {
    mouseLocked: false,
    keyboardLocked: false,
    controlEnabled: true
  }
  private onLockChangeCallback: ((state: InputLockState) => void) | null = null
  private lockTimeout: NodeJS.Timeout | null = null
  private inactivityTimer: NodeJS.Timeout | null = null
  private maxLockDuration = 30 * 60 * 1000 // 30 minutes max lock

  constructor() {
    this.setupInactivityDetection()
  }

  // Set lock change callback
  setLockChangeCallback(callback: (state: InputLockState) => void) {
    this.onLockChangeCallback = callback
  }

  // Get current lock state
  getLockState(): InputLockState {
    return { ...this.lockState }
  }

  // Enable/disable remote control
  setControlEnabled(enabled: boolean) {
    this.lockState.controlEnabled = enabled
    if (!enabled) {
      // Disable all input when control is disabled
      this.lockState.mouseLocked = true
      this.lockState.keyboardLocked = true
    }
    this.notifyLockChange()
  }

  // Lock mouse input
  lockMouse(locked: boolean) {
    if (!this.lockState.controlEnabled) return
    
    this.lockState.mouseLocked = locked
    this.notifyLockChange()
    
    if (locked) {
      this.startLockTimeout()
    } else {
      this.clearLockTimeout()
    }
  }

  // Lock keyboard input
  lockKeyboard(locked: boolean) {
    if (!this.lockState.controlEnabled) return
    
    this.lockState.keyboardLocked = locked
    this.notifyLockChange()
    
    if (locked) {
      this.startLockTimeout()
    } else {
      this.clearLockTimeout()
    }
  }

  // Lock all input
  lockAllInput() {
    this.lockState.mouseLocked = true
    this.lockState.keyboardLocked = true
    this.notifyLockChange()
    this.startLockTimeout()
  }

  // Unlock all input
  unlockAllInput() {
    this.lockState.mouseLocked = false
    this.lockState.keyboardLocked = false
    this.notifyLockChange()
    this.clearLockTimeout()
  }

  // Check if mouse input is allowed
  isMouseInputAllowed(): boolean {
    return this.lockState.controlEnabled && !this.lockState.mouseLocked
  }

  // Check if keyboard input is allowed
  isKeyboardInputAllowed(): boolean {
    return this.lockState.controlEnabled && !this.lockState.keyboardLocked
  }

  // Request control (from admin)
  requestControl(): boolean {
    if (!this.lockState.controlEnabled) {
      return false // Control disabled by user
    }
    
    // Auto-unlock for control request
    this.unlockAllInput()
    return true
  }

  // Revoke control (from user)
  revokeControl() {
    this.lockAllInput()
  }

  // Start lock timeout (auto-unlock after max duration)
  private startLockTimeout() {
    this.clearLockTimeout()
    this.lockTimeout = setTimeout(() => {
      console.log('Auto-unlocking input due to timeout')
      this.unlockAllInput()
    }, this.maxLockDuration)
  }

  // Clear lock timeout
  private clearLockTimeout() {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout)
      this.lockTimeout = null
    }
  }

  // Setup inactivity detection
  private setupInactivityDetection() {
    const resetInactivityTimer = () => {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer)
      }
      
      this.inactivityTimer = setTimeout(() => {
        console.log('Auto-locking due to inactivity')
        this.lockAllInput()
      }, 10 * 60 * 1000) // 10 minutes inactivity
    }

    // Listen for user activity
    document.addEventListener('mousemove', resetInactivityTimer)
    document.addEventListener('keydown', resetInactivityTimer)
    document.addEventListener('click', resetInactivityTimer)
    
    // Start initial timer
    resetInactivityTimer()
  }

  // Notify lock change
  private notifyLockChange() {
    if (this.onLockChangeCallback) {
      this.onLockChangeCallback(this.getLockState())
    }
  }

  // Get security status
  getSecurityStatus() {
    return {
      controlEnabled: this.lockState.controlEnabled,
      mouseLocked: this.lockState.mouseLocked,
      keyboardLocked: this.lockState.keyboardLocked,
      securityLevel: this.calculateSecurityLevel()
    }
  }

  // Calculate security level
  private calculateSecurityLevel(): 'low' | 'medium' | 'high' {
    if (!this.lockState.controlEnabled) return 'high'
    if (this.lockState.mouseLocked && this.lockState.keyboardLocked) return 'medium'
    return 'low'
  }

  // Emergency unlock (for debugging)
  emergencyUnlock() {
    this.unlockAllInput()
    this.lockState.controlEnabled = true
    this.notifyLockChange()
  }

  // Cleanup
  destroy() {
    this.clearLockTimeout()
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
    }
  }
}
