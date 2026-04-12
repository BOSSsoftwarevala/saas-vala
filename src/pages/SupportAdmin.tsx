import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Monitor, Phone, PhoneOff, MonitorOff, AlertCircle, Loader2, Maximize2, Minimize2, RotateCcw, Clock, Shield, ShieldOff, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { RemoteSupportConnection } from '@/lib/webrtc-connection'
import { InputLockSecurity } from '@/lib/input-lock-security'
import { ScreenFreezeProtection } from '@/lib/screen-freeze-protection'
import { SessionTimeout } from '@/lib/session-timeout'

interface RemoteClient {
  id: string
  client_id: string
  password: string
  status: 'online' | 'offline'
  last_seen: string
  user_id: string
}

interface RemoteSession {
  id: string
  session_id: string
  client_id: string
  admin_id: string
  status: 'active' | 'ended' | 'disconnected'
  start_time: string
  end_time: string | null
}

export default function SupportAdmin() {
  const [partnerId, setPartnerId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [session, setSession] = useState<RemoteSession | null>(null)
  const [remoteClient, setRemoteClient] = useState<RemoteClient | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const [controlGranted, setControlGranted] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('idle')
  const [networkQuality, setNetworkQuality] = useState(100)
  const [currentBitrate, setCurrentBitrate] = useState(0)
  const [freezeDetected, setFreezeDetected] = useState(false)
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const connectionRef = useRef<RemoteSupportConnection | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputLockRef = useRef<InputLockSecurity | null>(null)
  const freezeProtectionRef = useRef<ScreenFreezeProtection | null>(null)
  const sessionTimeoutRef = useRef<SessionTimeout | null>(null)

  // Initialize WebRTC connection
  const initializeConnection = async () => {
    try {
      connectionRef.current = new RemoteSupportConnection('admin')
      await connectionRef.current.initialize()

      // Setup callbacks
      connectionRef.current.onRemoteStream((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setConnected(true)
        setConnecting(false)
        toast.success('Connected to remote computer')
      })

      connectionRef.current.onConnectionState((state) => {
        const connectionState = state as any
        setConnectionState(connectionState)
        
        if (connectionState === 'disconnected' || connectionState === 'failed' || connectionState === 'closed') {
          handleDisconnect()
        } else if (connectionState === 'connecting') {
          setConnectionState('reconnecting')
        }
      })

      connectionRef.current.onDataChannel((data) => {
        if (data.type === 'control') {
          switch (data.command) {
            case 'grant_control':
              setControlGranted(true)
              toast.success('Control granted by remote user')
              break
            case 'revoke_control':
              setControlGranted(false)
              toast.info('Control revoked by remote user')
              break
          }
        }
      })

    } catch (error: any) {
      console.error('Failed to initialize connection:', error)
      setConnectionError('Failed to initialize connection')
      setConnecting(false)
    }
  }

  // Connect to remote client
  const handleConnect = async () => {
    if (!partnerId.trim() || !password.trim()) {
      toast.error('Please enter both Partner ID and Password')
      return
    }

    setConnecting(true)
    setConnectionError('')

    try {
      // Validate client credentials
      const { data: clientData, error: clientError } = await supabase.functions.invoke('remote-support', {
        body: {
          action: 'validate-client',
          client_id: partnerId.trim(),
          password: password.trim()
        }
      })

      if (clientError || !clientData?.success) {
        setConnectionError('Invalid Partner ID, Password, or client is offline')
        setConnecting(false)
        return
      }

      setRemoteClient(clientData.data)

      // Initialize WebRTC connection
      await initializeConnection()

      // Create WebRTC offer
      const offer = await connectionRef.current!.createOffer()

      // Create session
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('remote-support', {
        body: {
          action: 'create-session',
          client_id: partnerId.trim(),
          webrtc_offer: offer
        }
      })

      if (sessionError || !sessionData?.success) {
        setConnectionError('Failed to create session')
        setConnecting(false)
        return
      }

      setSession(sessionData.data)
      connectionRef.current!.setSessionId(sessionData.data.session_id)
      setSessionStartTime(new Date())
      setConnectionState('connected')
      
      // Initialize security features
      initializeSecurityFeatures()

      // Wait for answer (polling)
      const waitForAnswer = async () => {
        let attempts = 0
        const maxAttempts = 60 // 30 seconds max

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500))

          try {
            const { data: checkData } = await supabase
              .from('remote_sessions')
              .select('webrtc_answer')
              .eq('session_id', sessionData.data.session_id)
              .single()

            if (checkData?.webrtc_answer) {
              await connectionRef.current!.setRemoteDescription(checkData.webrtc_answer)
              return
            }
          } catch (error) {
            // Session might not exist yet, continue waiting
          }

          attempts++
        }

        setConnectionError('Connection timeout - remote user did not respond')
        setConnecting(false)
      }

      waitForAnswer()

    } catch (error: any) {
      console.error('Connection failed:', error)
      setConnectionError('Connection failed: ' + error.message)
      setConnecting(false)
    }
  }

  // Request control
  const requestControl = () => {
    if (connectionRef.current && connected) {
      connectionRef.current.sendControlCommand('request_control')
      toast.info('Control request sent to remote user')
    }
  }

  // Toggle full screen
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullScreen(true)
    } else {
      document.exitFullscreen()
      setIsFullScreen(false)
    }
  }

  // Reconnect session
  const handleReconnect = async () => {
    if (!partnerId.trim() || !password.trim()) {
      toast.error('Please enter Partner ID and Password')
      return
    }
    await handleConnect()
  }

  // Initialize security features
  const initializeSecurityFeatures = () => {
    if (!videoRef.current) return

    // Input lock security
    inputLockRef.current = new InputLockSecurity()
    inputLockRef.current.setLockChangeCallback((state) => {
      console.log('Input lock state changed:', state)
    })

    // Screen freeze protection
    freezeProtectionRef.current = new ScreenFreezeProtection(videoRef.current)
    freezeProtectionRef.current.setCallbacks(
      () => {
        setFreezeDetected(true)
        toast.warning('Screen freeze detected, attempting recovery...')
      },
      () => {
        setFreezeDetected(false)
        toast.success('Screen freeze resolved')
      }
    )

    // Session timeout
    sessionTimeoutRef.current = new SessionTimeout(30) // 30 minutes
    sessionTimeoutRef.current.setCallbacks(
      () => {
        toast.error('Session timed out')
        handleDisconnect()
      },
      (remainingTime) => {
        const minutes = Math.floor(remainingTime / 60000)
        toast.warning(`Session will expire in ${minutes} minutes due to inactivity`)
      },
      () => {
        // Activity detected - reset session timer
        console.log('Session activity detected')
      }
    )
    sessionTimeoutRef.current.start()

    // Monitor network quality
    const monitorNetwork = setInterval(() => {
      if (connectionRef.current) {
        const quality = connectionRef.current.getNetworkQuality()
        const bitrate = connectionRef.current.getCurrentBitrate()
        setNetworkQuality(quality)
        setCurrentBitrate(bitrate)
      }
    }, 2000)

    // Cleanup on unmount
    return () => {
      clearInterval(monitorNetwork)
    }
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    setConnected(false)
    setControlGranted(false)
    setSession(null)
    setRemoteClient(null)
    setSessionStartTime(null)
    setConnectionState('disconnected')
    setNetworkQuality(100)
    setCurrentBitrate(0)
    setFreezeDetected(false)
    setSessionTimeRemaining(0)

    // Cleanup security features
    if (inputLockRef.current) {
      inputLockRef.current.destroy()
      inputLockRef.current = null
    }
    if (freezeProtectionRef.current) {
      freezeProtectionRef.current.destroy()
      freezeProtectionRef.current = null
    }
    if (sessionTimeoutRef.current) {
      sessionTimeoutRef.current.destroy()
      sessionTimeoutRef.current = null
    }

    if (connectionRef.current) {
      await connectionRef.current.disconnect()
      connectionRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (isFullScreen) {
      document.exitFullscreen()
      setIsFullScreen(false)
    }

    toast.info('Disconnected from remote computer')
  }

  // Send keyboard events with security check
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (!controlGranted || !connected) return
    
    // Check input lock security
    if (inputLockRef.current && !inputLockRef.current.isKeyboardInputAllowed()) {
      return
    }

    connectionRef.current?.sendControlCommand('key_press', {
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    })
    
    // Reset session timeout on activity
    if (sessionTimeoutRef.current) {
      sessionTimeoutRef.current.reset()
    }
  }

  // Send mouse events with security check
  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!controlGranted || !connected || !videoRef.current) return
    
    // Check input lock security
    if (inputLockRef.current && !inputLockRef.current.isMouseInputAllowed()) {
      return
    }

    const rect = videoRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    connectionRef.current?.sendControlCommand('mouse_move', { x, y })
    
    // Reset session timeout on activity
    if (sessionTimeoutRef.current) {
      sessionTimeoutRef.current.reset()
    }
  }

  const handleMouseClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!controlGranted || !connected || !videoRef.current) return

    const rect = videoRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    connectionRef.current?.sendMouseClick(e.button, x, y)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.disconnect()
      }
    }
  }, [])

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Remote Support Admin</h1>
          <p className="text-muted-foreground">
            Connect to remote computers for support assistance
          </p>
        </div>

        {!connected ? (
          /* Connection Form */
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Connect to Remote Computer
              </CardTitle>
              <CardDescription>
                Enter the Partner ID and Password provided by the user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="partnerId">Partner ID</Label>
                <Input
                  id="partnerId"
                  placeholder="Enter 8-10 digit Partner ID"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  disabled={connecting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={connecting}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleConnect}
                disabled={connecting || !partnerId.trim() || !password.trim()}
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Remote View */
          <div className="space-y-4">
            {/* Connection Status Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Connected
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Partner ID: {remoteClient?.client_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {controlGranted && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        Control Active
                      </Badge>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnect}
                    >
                      <PhoneOff className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Remote Screen */}
            <Card>
              <CardContent className="p-0">
                <div ref={containerRef} className="relative bg-black aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                    onMouseMove={handleMouseMove}
                    onClick={handleMouseClick}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      handleMouseClick(e)
                    }}
                  />
                  
                  {/* Control Overlay */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    {/* Session Timer */}
                    {sessionStartTime && (
                      <div className="bg-black/50 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {Math.floor((Date.now() - sessionStartTime.getTime()) / 60000)}m
                      </div>
                    )}
                    
                    {/* Control Buttons */}
                    {!controlGranted && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={requestControl}
                      >
                        Request Control
                      </Button>
                    )}
                    {controlGranted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => connectionRef.current?.sendControlCommand('revoke_control')}
                      >
                        Release Control
                      </Button>
                    )}
                    
                    {/* Security Controls */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (inputLockRef.current) {
                          const state = inputLockRef.current.getLockState()
                          if (state.controlEnabled) {
                            inputLockRef.current.setControlEnabled(false)
                            toast.info('Control disabled by user')
                          } else {
                            inputLockRef.current.setControlEnabled(true)
                            toast.info('Control enabled')
                          }
                        }
                      }}
                    >
                      {inputLockRef.current?.getLockState().controlEnabled ? (
                        <Shield className="h-4 w-4" />
                      ) : (
                        <ShieldOff className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {/* Refresh Stream */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (freezeProtectionRef.current) {
                          freezeProtectionRef.current.forceRefresh()
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    
                    {/* Full Screen Toggle */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={toggleFullScreen}
                    >
                      {isFullScreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-black/50 text-white">
                        {controlGranted ? 'Control Mode' : 'View Only'}
                      </Badge>
                      <Badge variant="secondary" className="bg-black/50 text-white">
                        {connectionState}
                      </Badge>
                      {freezeDetected && (
                        <Badge variant="destructive" className="bg-red-600 text-white">
                          Frozen
                        </Badge>
                      )}
                    </div>
                    
                    {/* Network Quality Indicator */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 ${
                        networkQuality > 70 ? 'text-green-400' : 
                        networkQuality > 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {networkQuality > 70 ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        <span className="text-xs">{networkQuality}%</span>
                      </div>
                      {currentBitrate > 0 && (
                        <span className="text-xs text-gray-400">
                          {Math.round(currentBitrate / 1000)}kbps
                        </span>
                      )}
                    </div>
                    
                    {/* Session Timer */}
                    {sessionTimeoutRef.current && (
                      <div className="text-xs text-gray-400">
                        {sessionTimeoutRef.current.getFormattedRemainingTime()} remaining
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Click and drag to move mouse (if control is granted)</p>
                  <p>• Left-click to perform mouse actions</p>
                  <p>• Right-click for context menu</p>
                  <p>• Use keyboard for typing (if control is granted)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
