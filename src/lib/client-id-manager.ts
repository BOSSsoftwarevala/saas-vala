export class ClientIdManager {
  private static readonly STORAGE_KEY = 'ultraviewer_client_id'
  private static readonly CLIENT_ID_KEY = 'ultraviewer_persistent_id'

  // Generate persistent client ID
  static generatePersistentId(): string {
    const length = Math.floor(Math.random() * 3) + 8 // 8-10 digits
    return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0')
  }

  // Get or create persistent client ID
  static getOrCreatePersistentId(): string {
    // Try to get from localStorage first
    let persistentId = localStorage.getItem(this.CLIENT_ID_KEY)
    
    if (!persistentId) {
      // Generate new persistent ID
      persistentId = this.generatePersistentId()
      localStorage.setItem(this.CLIENT_ID_KEY, persistentId)
    }
    
    return persistentId
  }

  // Clear persistent ID (for testing/reset)
  static clearPersistentId(): void {
    localStorage.removeItem(this.CLIENT_ID_KEY)
    localStorage.removeItem(this.STORAGE_KEY)
  }

  // Store client data locally
  static storeClientData(clientData: { client_id: string; password: string; status: string }): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clientData))
  }

  // Get stored client data
  static getStoredClientData(): { client_id: string; password: string; status: string } | null {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  }

  // Clear stored client data
  static clearStoredClientData(): void {
    localStorage.removeItem(this.STORAGE_KEY)
  }

  // Check if client ID exists locally
  static hasClientId(): boolean {
    return !!localStorage.getItem(this.CLIENT_ID_KEY)
  }

  // Get device fingerprint for additional persistence
  static getDeviceFingerprint(): string {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Device fingerprint', 2, 2)
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|')
    
    return btoa(fingerprint).substring(0, 16)
  }

  // Validate persistent ID format
  static isValidClientId(id: string): boolean {
    return /^\d{8,10}$/.test(id)
  }

  // Generate new password
  static generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }
}
