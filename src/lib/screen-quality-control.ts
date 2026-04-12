export interface QualitySettings {
  width: number
  height: number
  frameRate: number
  bitrate: number
  name: string
}

export class ScreenQualityControl {
  private currentQuality: QualitySettings
  private availableQualities: QualitySettings[]
  private networkMonitor: NetworkMonitor
  private onQualityChangeCallback: ((quality: QualitySettings) => void) | null = null

  constructor() {
    this.networkMonitor = new NetworkMonitor()
    
    // Define quality presets
    this.availableQualities = [
      { name: 'low', width: 640, height: 480, frameRate: 15, bitrate: 200000 },
      { name: 'medium', width: 1280, height: 720, frameRate: 30, bitrate: 800000 },
      { name: 'high', width: 1920, height: 1080, frameRate: 30, bitrate: 2000000 },
      { name: 'ultra', width: 1920, height: 1080, frameRate: 60, bitrate: 4000000 }
    ]

    // Start with medium quality
    this.currentQuality = this.availableQualities[1]
    
    // Start network monitoring
    this.startNetworkMonitoring()
  }

  // Set quality change callback
  setQualityChangeCallback(callback: (quality: QualitySettings) => void) {
    this.onQualityChangeCallback = callback
  }

  // Get current quality settings
  getCurrentQuality(): QualitySettings {
    return this.currentQuality
  }

  // Manually set quality
  setQuality(qualityName: string) {
    const quality = this.availableQualities.find(q => q.name === qualityName)
    if (quality) {
      this.currentQuality = quality
      this.notifyQualityChange()
    }
  }

  // Auto-adjust quality based on network conditions
  private adjustQualityBasedOnNetwork() {
    const networkInfo = this.networkMonitor.getNetworkInfo()
    
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
      this.switchToQuality('low')
    } else if (networkInfo.effectiveType === '3g') {
      this.switchToQuality('medium')
    } else if (networkInfo.effectiveType === '4g') {
      this.switchToQuality('high')
    } else {
      // Unknown or very fast connection
      this.switchToQuality('high')
    }
  }

  // Switch to specific quality
  private switchToQuality(qualityName: string) {
    const newQuality = this.availableQualities.find(q => q.name === qualityName)
    if (newQuality && newQuality.name !== this.currentQuality.name) {
      this.currentQuality = newQuality
      this.notifyQualityChange()
      console.log(`Quality adjusted to ${qualityName}`)
    }
  }

  // Notify quality change
  private notifyQualityChange() {
    if (this.onQualityChangeCallback) {
      this.onQualityChangeCallback(this.currentQuality)
    }
  }

  // Start network monitoring
  private startNetworkMonitoring() {
    setInterval(() => {
      this.adjustQualityBasedOnNetwork()
    }, 5000) // Check every 5 seconds

    // Listen for network changes
    this.networkMonitor.onConnectionChange(() => {
      this.adjustQualityBasedOnNetwork()
    })
  }

  // Get optimal constraints for getUserMedia
  getMediaConstraints(): MediaStreamConstraints {
    return {
      video: {
        width: { ideal: this.currentQuality.width },
        height: { ideal: this.currentQuality.height },
        frameRate: { ideal: this.currentQuality.frameRate },
        // Add more constraints for better quality
        aspectRatio: { ideal: 16/9 },
        facingMode: 'screen'
      },
      audio: false // We'll add audio later if needed
    }
  }

  // Cleanup
  destroy() {
    this.networkMonitor.destroy()
  }
}

class NetworkMonitor {
  private connection: any = null
  private onConnectionChangeCallback: (() => void) | null = null

  constructor() {
    // Get network connection API if available
    this.connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection
  }

  // Get current network information
  getNetworkInfo() {
    if (!this.connection) {
      return {
        effectiveType: '4g', // Assume good connection if API not available
        downlink: 10,
        rtt: 100
      }
    }

    return {
      effectiveType: this.connection.effectiveType || '4g',
      downlink: this.connection.downlink || 10,
      rtt: this.connection.rtt || 100
    }
  }

  // Set connection change callback
  onConnectionChange(callback: () => void) {
    this.onConnectionChangeCallback = callback
    
    if (this.connection) {
      this.connection.addEventListener('change', callback)
    }
  }

  // Cleanup
  destroy() {
    if (this.connection && this.onConnectionChangeCallback) {
      this.connection.removeEventListener('change', this.onConnectionChangeCallback)
    }
  }
}
