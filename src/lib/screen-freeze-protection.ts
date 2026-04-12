export class ScreenFreezeProtection {
  private videoElement: HTMLVideoElement | null = null
  private lastFrameTime: number = 0
  private freezeDetectionInterval: NodeJS.Timeout | null = null
  private freezeThreshold: number = 5000 // 5 seconds without frame update
  private onFreezeDetectedCallback: (() => void) | null = null
  private onFreezeResolvedCallback: (() => void) | null = null
  private isFrozen: boolean = false
  private frameCheckInterval: NodeJS.Timeout | null = null
  private pixelCheckInterval: NodeJS.Timeout | null = null
  private lastImageData: ImageData | null = null

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement
    this.startMonitoring()
  }

  // Set freeze detection callbacks
  setCallbacks(
    onFreezeDetected: () => void,
    onFreezeResolved: () => void
  ) {
    this.onFreezeDetectedCallback = onFreezeDetected
    this.onFreezeResolvedCallback = onFreezeResolved
  }

  // Start monitoring for frozen frames
  private startMonitoring() {
    // Monitor video time updates
    this.freezeDetectionInterval = setInterval(() => {
      this.checkForFreeze()
    }, 1000) // Check every second

    // Monitor frame changes via pixel comparison
    this.pixelCheckInterval = setInterval(() => {
      this.checkPixelChanges()
    }, 2000) // Check every 2 seconds
  }

  // Check if video is frozen based on time updates
  private checkForFreeze() {
    if (!this.videoElement) return

    const currentTime = this.videoElement.currentTime
    const now = Date.now()

    if (currentTime > 0) {
      if (this.lastFrameTime === 0) {
        // First frame detected
        this.lastFrameTime = now
        return
      }

      const timeSinceLastFrame = now - this.lastFrameTime

      if (timeSinceLastFrame > this.freezeThreshold) {
        if (!this.isFrozen) {
          this.handleFreezeDetected()
        }
      } else {
        if (this.isFrozen) {
          this.handleFreezeResolved()
        }
      }
    }
  }

  // Check for pixel changes (more accurate freeze detection)
  private checkPixelChanges() {
    if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) return

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = 160 // Small size for performance
      canvas.height = 90

      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height)
      const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      if (this.lastImageData) {
        const hasChanged = this.compareImageData(this.lastImageData, currentImageData)
        
        if (!hasChanged && !this.isFrozen) {
          // No pixel changes detected - likely frozen
          this.handleFreezeDetected()
        } else if (hasChanged && this.isFrozen) {
          // Pixel changes detected - freeze resolved
          this.handleFreezeResolved()
        }
      }

      this.lastImageData = currentImageData
    } catch (error) {
      console.error('Error checking pixel changes:', error)
    }
  }

  // Compare two ImageData objects for differences
  private compareImageData(img1: ImageData, img2: ImageData): boolean {
    if (img1.width !== img2.width || img1.height !== img2.height) {
      return true // Different dimensions = changed
    }

    const data1 = img1.data
    const data2 = img2.data
    const threshold = 1000 // Allow some noise
    let differences = 0

    for (let i = 0; i < data1.length; i += 4) {
      // Compare RGB values (skip alpha)
      if (Math.abs(data1[i] - data2[i]) > 30 ||
          Math.abs(data1[i + 1] - data2[i + 1]) > 30 ||
          Math.abs(data1[i + 2] - data2[i + 2]) > 30) {
        differences++
        if (differences > threshold) {
          return true // Significant difference detected
        }
      }
    }

    return false // No significant differences
  }

  // Handle freeze detection
  private handleFreezeDetected() {
    this.isFrozen = true
    console.warn('Screen freeze detected')
    
    if (this.onFreezeDetectedCallback) {
      this.onFreezeDetectedCallback()
    }

    // Attempt automatic recovery
    this.attemptRecovery()
  }

  // Handle freeze resolution
  private handleFreezeResolved() {
    this.isFrozen = false
    console.log('Screen freeze resolved')
    
    if (this.onFreezeResolvedCallback) {
      this.onFreezeResolvedCallback()
    }
  }

  // Attempt automatic recovery from freeze
  private attemptRecovery() {
    if (!this.videoElement) return

    console.log('Attempting freeze recovery...')

    // Method 1: Reload video source
    const currentSrc = this.videoElement.src
    this.videoElement.src = ''
    setTimeout(() => {
      if (this.videoElement) {
        this.videoElement.src = currentSrc
        this.videoElement.play().catch(console.error)
      }
    }, 100)

    // Method 2: Reset last frame time
    this.lastFrameTime = Date.now()

    // Method 3: Clear image data cache
    this.lastImageData = null
  }

  // Manual refresh trigger
  forceRefresh() {
    console.log('Manual refresh triggered')
    this.attemptRecovery()
  }

  // Check if currently frozen
  isCurrentlyFrozen(): boolean {
    return this.isFrozen
  }

  // Update freeze threshold
  setFreezeThreshold(milliseconds: number) {
    this.freezeThreshold = milliseconds
  }

  // Get monitoring status
  getMonitoringStatus() {
    return {
      isMonitoring: this.freezeDetectionInterval !== null,
      isFrozen: this.isFrozen,
      lastFrameTime: this.lastFrameTime,
      freezeThreshold: this.freezeThreshold
    }
  }

  // Temporarily disable monitoring
  pauseMonitoring() {
    if (this.freezeDetectionInterval) {
      clearInterval(this.freezeDetectionInterval)
      this.freezeDetectionInterval = null
    }
    if (this.pixelCheckInterval) {
      clearInterval(this.pixelCheckInterval)
      this.pixelCheckInterval = null
    }
  }

  // Resume monitoring
  resumeMonitoring() {
    if (!this.freezeDetectionInterval) {
      this.startMonitoring()
    }
  }

  // Update video element
  updateVideoElement(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement
    this.lastFrameTime = 0
    this.lastImageData = null
    this.isFrozen = false
  }

  // Cleanup
  destroy() {
    if (this.freezeDetectionInterval) {
      clearInterval(this.freezeDetectionInterval)
    }
    if (this.pixelCheckInterval) {
      clearInterval(this.pixelCheckInterval)
    }
    if (this.frameCheckInterval) {
      clearInterval(this.frameCheckInterval)
    }
  }
}
