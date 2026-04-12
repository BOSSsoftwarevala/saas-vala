import { supabase } from '@/integrations/supabase/client'
import { ScreenQualityControl } from './screen-quality-control'
import { BandwidthOptimizer } from './bandwidth-optimizer'
import { AutoReconnectEngine } from './auto-reconnect'

export interface WebRTCConnection {
  peerConnection: RTCPeerConnection
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  sessionId: string
  role: 'admin' | 'client'
}

export class RemoteSupportConnection {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private sessionId: string = ''
  private role: 'admin' | 'client' = 'client'
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null
  private onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null
  private onDataChannelMessage: ((data: any) => void) | null = null
  private dataChannel: RTCDataChannel | null = null
  
  // Advanced features
  private qualityControl: ScreenQualityControl | null = null
  private bandwidthOptimizer: BandwidthOptimizer | null = null
  private autoReconnect: AutoReconnectEngine | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  constructor(role: 'admin' | 'client') {
    this.role = role
  }

  // Initialize WebRTC connection
  async initialize(): Promise<void> {
    const configuration = {
      iceServers: [
        // Primary STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // Backup STUN servers
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.nextcloud.com:443' },
        
        // TURN servers (if needed for NAT traversal)
        // Note: These are free TURN servers, replace with your own in production
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all' as RTCIceTransportPolicy
    }

    this.peerConnection = new RTCPeerConnection(configuration)

    // Initialize advanced features
    this.qualityControl = new ScreenQualityControl()
    this.bandwidthOptimizer = new BandwidthOptimizer(this.peerConnection)
    this.autoReconnect = new AutoReconnectEngine()

    // Setup callbacks
    this.qualityControl.setQualityChangeCallback((quality) => {
      console.log('Quality changed:', quality)
      // Restart stream with new quality if needed
    })

    this.autoReconnect.setCallbacks(
      () => this.attemptReconnect(),
      () => console.log('Reconnect successful'),
      () => console.log('Reconnect failed')
    )

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state)
      }
      
      // Handle connection loss
      if (state === 'disconnected' || state === 'failed') {
        this.autoReconnect.startReconnect()
      } else if (state === 'connected') {
        this.autoReconnect.stopReconnect()
      }
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0]
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream)
      }
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(event.candidate)
      }
    }

    // Create data channel for admin (control commands)
    if (this.role === 'admin') {
      this.dataChannel = this.peerConnection.createDataChannel('control')
      this.setupDataChannel()
    } else {
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel
        this.setupDataChannel()
      }
    }
  }

  // Setup data channel for control commands
  private setupDataChannel(): void {
    if (!this.dataChannel) return

    this.dataChannel.onopen = () => {
      console.log('Data channel opened')
    }

    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (this.onDataChannelMessage) {
          this.onDataChannelMessage(data)
        }
      } catch (error) {
        console.error('Failed to parse data channel message:', error)
      }
    }

    this.dataChannel.onclose = () => {
      console.log('Data channel closed')
    }
  }

  // Start screen sharing with quality control
  async startScreenShare(): Promise<void> {
    try {
      if (!this.qualityControl) throw new Error('Quality control not initialized')

      const constraints = this.qualityControl.getMediaConstraints()
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints)

      this.localStream = stream

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        const sender = this.peerConnection?.addTrack(track, stream)
        if (sender && this.bandwidthOptimizer) {
          this.bandwidthOptimizer.setVideoSender(sender)
        }
      })

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenShare()
      })

      // Optimize bandwidth based on initial network conditions
      if (this.bandwidthOptimizer) {
        const networkQuality = this.bandwidthOptimizer.getNetworkQuality()
        if (networkQuality < 50) {
          this.bandwidthOptimizer.optimizeForLowBandwidth()
        } else {
          this.bandwidthOptimizer.optimizeForHighBandwidth()
        }
      }

    } catch (error: any) {
      console.error('Error starting screen share:', error)
      throw error
    }
  }

  // Create offer (admin initiates connection)
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized')

    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)
    return offer
  }

  // Create answer (client responds)
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized')

    await this.peerConnection.setRemoteDescription(offer)
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    return answer
  }

  // Set remote description
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized')
    await this.peerConnection.setRemoteDescription(description)
  }

  // Add ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized')
    await this.peerConnection.addIceCandidate(candidate)
  }

  // Send control command
  sendControlCommand(command: string, data?: any): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('Data channel not ready')
      return
    }

    const message = {
      type: 'control',
      command,
      data,
      timestamp: Date.now()
    }

    this.dataChannel.send(JSON.stringify(message))
  }

  // Request control permission
  requestControl(): void {
    this.sendControlCommand('request_control')
  }

  // Grant control permission
  grantControl(): void {
    this.sendControlCommand('grant_control')
  }

  // Revoke control permission
  revokeControl(): void {
    this.sendControlCommand('revoke_control')
  }

  // Send mouse movement
  sendMouseMove(x: number, y: number): void {
    this.sendControlCommand('mouse_move', { x, y })
  }

  // Send mouse click
  sendMouseClick(button: number, x: number, y: number): void {
    this.sendControlCommand('mouse_click', { button, x, y })
  }

  // Send keyboard input
  sendKeyboardInput(key: string, modifiers: string[] = []): void {
    this.sendControlCommand('keyboard_input', { key, modifiers })
  }

  // Send ICE candidate to server
  private async sendIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('remote-support', {
        body: {
          action: 'update-session',
          session_id: this.sessionId,
          ice_candidates: [candidate]
        }
      })

      if (error) {
        console.error('Failed to send ICE candidate:', error)
      }
    } catch (error) {
      console.error('Failed to send ICE candidate:', error)
    }
  }

  // Set callbacks
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback
  }

  onConnectionState(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateChange = callback
  }

  onDataChannel(callback: (data: any) => void): void {
    this.onDataChannelMessage = callback
  }

  // Get connection state
  get connectionState(): RTCPeerConnectionState {
    return this.peerConnection?.connectionState || 'closed'
  }

  // Get remote stream
  get remoteStreamMedia(): MediaStream | null {
    return this.remoteStream
  }

  // Get local stream
  get localStreamMedia(): MediaStream | null {
    return this.localStream
  }

  // Get connection statistics
  async getStats(): Promise<RTCStatsReport> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }
    return this.peerConnection.getStats()
  }

  // Get network quality
  getNetworkQuality(): number {
    return this.bandwidthOptimizer?.getNetworkQuality() || 100
  }

  // Set quality preset
  setQualityPreset(preset: 'low' | 'medium' | 'high' | 'auto') {
    this.bandwidthOptimizer?.setQualityPreset(preset)
  }

  // Get current bitrate
  getCurrentBitrate(): number {
    return this.bandwidthOptimizer?.getCurrentBitrate() || 0
  }

  // Attempt reconnect
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnect attempts reached')
    }

    this.reconnectAttempts++
    console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)

    try {
      // Close existing connection
      if (this.peerConnection) {
        this.peerConnection.close()
      }

      // Reinitialize
      await this.initialize()
      
      // Restart screen share if client
      if (this.role === 'client' && this.localStream) {
        await this.startScreenShare()
      }

      // Restart connection process based on role
      if (this.role === 'admin') {
        // Admin would need to recreate offer
        // This would be handled by the calling code
      }

    } catch (error) {
      console.error('Reconnect failed:', error)
      throw error
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    // Stop auto reconnect
    if (this.autoReconnect) {
      this.autoReconnect.stopReconnect()
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Cleanup advanced features
    if (this.qualityControl) {
      this.qualityControl.destroy()
    }
    if (this.bandwidthOptimizer) {
      this.bandwidthOptimizer.destroy()
    }
    if (this.autoReconnect) {
      this.autoReconnect.destroy()
      try {
        await supabase.functions.invoke('remote-support', {
          body: {
            action: 'end-session',
            session_id: this.sessionId
          }
        })
      } catch (error) {
        console.error('Failed to end session:', error)
      }
    }

    this.remoteStream = null
    this.sessionId = ''
  }

  // Set session ID
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
  }
}
