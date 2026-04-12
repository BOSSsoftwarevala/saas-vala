import { supabase } from '@/integrations/supabase/client'
import { RemoteSupportConnection } from './webrtc-connection'

export class RemoteSupportClient {
  private connection: RemoteSupportConnection | null = null
  private clientId: string = ''
  private onIncomingCall: ((sessionId: string, adminId: string) => void) | null = null
  private onSessionEnd: (() => void) | null = null
  private pollingInterval: NodeJS.Timeout | null = null

  constructor(clientId: string) {
    this.clientId = clientId
  }

  // Initialize client
  async initialize(): Promise<void> {
    this.connection = new RemoteSupportConnection('client')
    await this.connection.initialize()

    // Setup callbacks
    this.connection.onConnectionState((state) => {
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.handleSessionEnd()
      }
    })

    this.connection.onDataChannel((data) => {
      this.handleControlCommand(data)
    })

    // Start polling for incoming sessions
    this.startPolling()
  }

  // Start polling for incoming sessions
  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      await this.checkForIncomingSessions()
    }, 2000) // Check every 2 seconds
  }

  // Check for incoming sessions
  private async checkForIncomingSessions(): Promise<void> {
    try {
      const { data: sessions } = await supabase
        .from('remote_sessions')
        .select('*')
        .eq('client_id', this.clientId)
        .eq('status', 'active')
        .is('webrtc_answer', null)
        .order('created_at', { ascending: false })
        .limit(1)

      if (sessions && sessions.length > 0) {
        const session = sessions[0]
        if (this.onIncomingCall) {
          this.onIncomingCall(session.session_id, session.admin_id)
        }
        this.stopPolling()
      }
    } catch (error) {
      console.error('Error checking for sessions:', error)
    }
  }

  // Accept incoming call
  async acceptCall(sessionId: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized')
    }

    try {
      // Get session data
      const { data: session, error } = await supabase
        .from('remote_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (error || !session) {
        throw new Error('Session not found')
      }

      this.connection.setSessionId(sessionId)

      // Get screen share
      await this.connection.getScreenShare()

      // Create answer
      const answer = await this.connection.createAnswer(session.webrtc_offer)

      // Update session with answer
      const { error: updateError } = await supabase.functions.invoke('remote-support', {
        body: {
          action: 'update-session',
          session_id: sessionId,
          webrtc_answer: answer
        }
      })

      if (updateError) {
        throw new Error('Failed to update session')
      }

    } catch (error: any) {
      console.error('Failed to accept call:', error)
      throw error
    }
  }

  // Reject incoming call
  async rejectCall(sessionId: string): Promise<void> {
    try {
      await supabase.functions.invoke('remote-support', {
        body: {
          action: 'end-session',
          session_id: sessionId
        }
      })

      // Resume polling
      this.startPolling()
    } catch (error: any) {
      console.error('Failed to reject call:', error)
      throw error
    }
  }

  // Handle control commands
  private handleControlCommand(data: any): void {
    if (data.type !== 'control') return

    switch (data.command) {
      case 'request_control':
        // Show request control dialog
        if (confirm('Support personnel is requesting control of your computer. Allow?')) {
          this.connection?.sendControlCommand('grant_control')
        } else {
          this.connection?.sendControlCommand('deny_control')
        }
        break

      case 'mouse_move':
        // Handle mouse movement (would need implementation for actual control)
        this.simulateMouseMove(data.data.x, data.data.y)
        break

      case 'mouse_click':
        // Handle mouse click
        this.simulateMouseClick(data.data.button, data.data.x, data.data.y)
        break

      case 'keyboard_input':
        // Handle keyboard input
        this.simulateKeyboardInput(data.data.key, data.data.modifiers)
        break
    }
  }

  // Simulate mouse movement (placeholder - would need actual implementation)
  private simulateMouseMove(x: number, y: number): void {
    // This would require browser extension or native app for actual control
    console.log('Mouse move:', x, y)
  }

  // Simulate mouse click (placeholder - would need actual implementation)
  private simulateMouseClick(button: number, x: number, y: number): void {
    // This would require browser extension or native app for actual control
    console.log('Mouse click:', button, x, y)
  }

  // Simulate keyboard input (placeholder - would need actual implementation)
  private simulateKeyboardInput(key: string, modifiers: string[]): void {
    // This would require browser extension or native app for actual control
    console.log('Keyboard input:', key, modifiers)
  }

  // Handle session end
  private handleSessionEnd(): void {
    if (this.onSessionEnd) {
      this.onSessionEnd()
    }
    this.startPolling()
  }

  // Stop polling
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    this.stopPolling()
    
    if (this.connection) {
      await this.connection.disconnect()
      this.connection = null
    }
  }

  // Set callbacks
  setOnIncomingCall(callback: (sessionId: string, adminId: string) => void): void {
    this.onIncomingCall = callback
  }

  setOnSessionEnd(callback: () => void): void {
    this.onSessionEnd = callback
  }

  // Get connection state
  get connectionState(): RTCPeerConnectionState {
    return this.connection?.connectionState || 'closed'
  }

  // Check if in call
  get inCall(): boolean {
    return this.connection?.connectionState === 'connected'
  }
}
