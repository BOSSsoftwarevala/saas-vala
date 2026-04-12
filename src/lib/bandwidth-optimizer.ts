export class BandwidthOptimizer {
  private peerConnection: RTCPeerConnection | null = null
  private videoSender: RTCRtpSender | null = null
  private currentBitrate: number = 2000000 // Default 2Mbps
  private minBitrate: number = 100000 // 100kbps minimum
  private maxBitrate: number = 5000000 // 5Mbps maximum
  private adaptiveInterval: NodeJS.Timeout | null = null
  private rttHistory: number[] = []
  private packetLossHistory: number[] = []

  constructor(peerConnection: RTCPeerConnection) {
    this.peerConnection = peerConnection
    this.startAdaptiveBitrate()
  }

  // Set video sender for bitrate control
  setVideoSender(sender: RTCRtpSender) {
    this.videoSender = sender
  }

  // Adaptive bitrate based on network conditions
  private startAdaptiveBitrate() {
    this.adaptiveInterval = setInterval(() => {
      this.adjustBitrate()
    }, 2000) // Check every 2 seconds
  }

  // Adjust bitrate based on network metrics
  private async adjustBitrate() {
    if (!this.videoSender || !this.peerConnection) return

    try {
      // Get network statistics
      const stats = await this.peerConnection.getStats()
      let rtt = 0
      let packetLoss = 0

      stats.forEach(report => {
        if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
          rtt = report.roundTripTime || 0
          packetLoss = report.packetsLost ? (report.packetsLost / (report.packetsReceived + report.packetsLost)) : 0
        }
      })

      // Update history
      this.rttHistory.push(rtt)
      this.packetLossHistory.push(packetLoss)
      
      // Keep only last 10 measurements
      if (this.rttHistory.length > 10) this.rttHistory.shift()
      if (this.packetLossHistory.length > 10) this.packetLossHistory.shift()

      // Calculate averages
      const avgRtt = this.rttHistory.reduce((a, b) => a + b, 0) / this.rttHistory.length
      const avgPacketLoss = this.packetLossHistory.reduce((a, b) => a + b, 0) / this.packetLossHistory.length

      // Adjust bitrate based on conditions
      let newBitrate = this.currentBitrate

      if (avgRtt > 500 || avgPacketLoss > 0.05) {
        // Poor network conditions - reduce bitrate
        newBitrate = Math.max(this.minBitrate, this.currentBitrate * 0.8)
      } else if (avgRtt < 100 && avgPacketLoss < 0.01) {
        // Good network conditions - increase bitrate
        newBitrate = Math.min(this.maxBitrate, this.currentBitrate * 1.1)
      }

      if (newBitrate !== this.currentBitrate) {
        await this.setBitrate(newBitrate)
        console.log(`Bitrate adjusted: ${Math.round(this.currentBitrate / 1000)}kbps`)
      }

    } catch (error) {
      console.error('Error adjusting bitrate:', error)
    }
  }

  // Set specific bitrate
  private async setBitrate(bitrate: number) {
    if (!this.videoSender) return

    try {
      const parameters = this.videoSender.getParameters()
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}]
      }

      parameters.encodings[0].maxBitrate = bitrate
      await this.videoSender.setParameters(parameters)
      this.currentBitrate = bitrate
    } catch (error) {
      console.error('Error setting bitrate:', error)
    }
  }

  // Manual bitrate control
  setQualityPreset(preset: 'low' | 'medium' | 'high' | 'auto') {
    switch (preset) {
      case 'low':
        this.setBitrate(500000) // 500kbps
        break
      case 'medium':
        this.setBitrate(1500000) // 1.5Mbps
        break
      case 'high':
        this.setBitrate(3000000) // 3Mbps
        break
      case 'auto':
        // Resume adaptive bitrate
        this.startAdaptiveBitrate()
        break
    }
  }

  // Get current bitrate
  getCurrentBitrate(): number {
    return this.currentBitrate
  }

  // Enable/disable video compression
  enableCompression(enabled: boolean) {
    if (!this.videoSender) return

    try {
      const parameters = this.videoSender.getParameters()
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}]
      }

      // Enable/disable scalability mode for better compression (if supported)
      if (enabled && 'scalabilityMode' in parameters.encodings[0]) {
        (parameters.encodings[0] as any).scalabilityMode = 'L1T3'
      } else if ('scalabilityMode' in parameters.encodings[0]) {
        delete (parameters.encodings[0] as any).scalabilityMode
      }

      this.videoSender.setParameters(parameters)
    } catch (error) {
      console.error('Error setting compression:', error)
    }
  }

  // Optimize for low bandwidth
  optimizeForLowBandwidth() {
    this.setQualityPreset('low')
    this.enableCompression(true)
  }

  // Optimize for high bandwidth
  optimizeForHighBandwidth() {
    this.setQualityPreset('high')
    this.enableCompression(false)
  }

  // Get network quality score (0-100)
  getNetworkQuality(): number {
    if (this.rttHistory.length === 0) return 100

    const avgRtt = this.rttHistory.reduce((a, b) => a + b, 0) / this.rttHistory.length
    const avgPacketLoss = this.packetLossHistory.reduce((a, b) => a + b, 0) / this.packetLossHistory.length

    // Calculate quality score
    let score = 100
    
    // Penalize high RTT
    if (avgRtt > 100) score -= Math.min(50, (avgRtt - 100) / 10)
    
    // Penalize packet loss
    if (avgPacketLoss > 0) score -= Math.min(50, avgPacketLoss * 1000)

    return Math.max(0, Math.min(100, score))
  }

  // Cleanup
  destroy() {
    if (this.adaptiveInterval) {
      clearInterval(this.adaptiveInterval)
    }
  }
}
