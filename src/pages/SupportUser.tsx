import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Copy, Monitor, Wifi, WifiOff, RefreshCw, Phone, PhoneOff, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { RemoteSupportClient } from '@/lib/webrtc-client'
import { ClientIdManager } from '@/lib/client-id-manager'

interface RemoteClient {
  id: string
  client_id: string
  password: string
  status: 'online' | 'offline'
  last_seen: string
}

export default function SupportUser() {
  const [client, setClient] = useState<RemoteClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [incomingCall, setIncomingCall] = useState<{ sessionId: string; adminId: string } | null>(null)
  const [inCall, setInCall] = useState(false)
  const [rtcClient, setRtcClient] = useState<RemoteSupportClient | null>(null)

  // Get or create remote client for user
  const getOrCreateClient = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get persistent client ID
      const persistentId = ClientIdManager.getOrCreatePersistentId()
      const newPassword = ClientIdManager.generatePassword()

      const { data, error } = await supabase.functions.invoke('remote-support', {
        body: { 
          action: 'get-or-create-client',
          client_id: persistentId,
          password: newPassword
        }
      })

      if (error) throw error
      if (data?.success) {
        setClient(data.data)
        ClientIdManager.storeClientData(data.data)
      }
    } catch (error: any) {
      console.error('Failed to get client:', error)
      toast.error('Failed to initialize remote support')
    } finally {
      setLoading(false)
    }
  }

  // Rotate password
  const rotatePassword = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !client) return

      const newPassword = ClientIdManager.generatePassword()

      const { data, error } = await supabase.functions.invoke('remote-support', {
        body: { 
          action: 'update-password',
          client_id: client.client_id,
          password: newPassword
        }
      })

      if (error) throw error
      if (data?.success) {
        setClient(data.data)
        ClientIdManager.storeClientData(data.data)
        toast.success('Password refreshed successfully')
      }
    } catch (error: any) {
      console.error('Failed to rotate password:', error)
      toast.error('Failed to refresh password')
    }
  }

  // Update client status
  const updateStatus = async (status: 'online' | 'offline') => {
    try {
      const { error } = await supabase.functions.invoke('remote-support', {
        body: { action: 'update-status', status }
      })

      if (error) throw error
      
      if (client) {
        setClient({ ...client, status, last_seen: new Date().toISOString() })
      }
    } catch (error: any) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
    }
  }

  // Copy to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !rtcClient) return

    try {
      await rtcClient.acceptCall(incomingCall.sessionId)
      setInCall(true)
      setIncomingCall(null)
      toast.success('Connected to support personnel')
    } catch (error: any) {
      console.error('Failed to accept call:', error)
      toast.error('Failed to connect: ' + error.message)
      setIncomingCall(null)
    }
  }

  // Reject incoming call
  const rejectCall = async () => {
    if (!incomingCall || !rtcClient) return

    try {
      await rtcClient.rejectCall(incomingCall.sessionId)
      setIncomingCall(null)
      toast.info('Call rejected')
    } catch (error: any) {
      console.error('Failed to reject call:', error)
      toast.error('Failed to reject call')
      setIncomingCall(null)
    }
  }

  // End current call
  const endCall = async () => {
    if (!rtcClient) return

    try {
      await rtcClient.disconnect()
      setInCall(false)
      toast.info('Call ended')
    } catch (error: any) {
      console.error('Failed to end call:', error)
      toast.error('Failed to end call')
    }
  }

  // Refresh client data
  const refreshClient = async () => {
    setRefreshing(true)
    await getOrCreateClient()
    setRefreshing(false)
  }

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateStatus('offline')
      } else {
        updateStatus('online')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      updateStatus('offline')
    }
  }, [client])

  // Handle before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      updateStatus('offline')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [client])

  // Initialize RTC client when client data is available
  useEffect(() => {
    if (client && !rtcClient) {
      const client = new RemoteSupportClient(client.client_id)
      client.initialize()
      client.onIncomingCall((sessionId, adminId) => {
        setIncomingCall({ sessionId, adminId })
      })
      client.onSessionEnd(() => {
        setInCall(false)
        toast.info('Remote session ended')
      })
      setRtcClient(client)
    }
  }, [client])

  // Initial load
  useEffect(() => {
    getOrCreateClient()
  }, [])

  // Auto-refresh status with heartbeat
  useEffect(() => {
    if (!client) return

    const interval = setInterval(() => {
      if (!document.hidden) {
        updateStatus('online')
      }
    }, 5000) // Update every 5 seconds (heartbeat)

    return () => clearInterval(interval)
  }, [client])

  // Load stored client data on mount
  useEffect(() => {
    const storedData = ClientIdManager.getStoredClientData()
    if (storedData) {
      setClient(storedData)
      setLoading(false)
    } else {
      getOrCreateClient()
    }
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Remote Support</h1>
          <p className="text-muted-foreground">
            Share these credentials with support personnel to receive remote assistance
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                <CardTitle>Your Status</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={client?.status === 'online' ? 'default' : 'secondary'}
                  className="flex items-center gap-1"
                >
                  {client?.status === 'online' ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {client?.status === 'online' ? 'Online' : 'Offline'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshClient}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <CardDescription>
              {client?.status === 'online' 
                ? 'You are visible to support personnel'
                : 'You are currently offline and not visible to support personnel'
              }
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Credentials Card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Remote Support Credentials</CardTitle>
            <CardDescription>
              Share these credentials with support personnel to allow them to connect to your computer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Your ID</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-muted rounded-md font-mono text-lg text-center">
                  {client?.client_id || 'Loading...'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(client?.client_id || '', 'Your ID')}
                  disabled={!client?.client_id}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Password</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-muted rounded-md font-mono text-lg text-center">
                  {client?.password || 'Loading...'}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => copyToClipboard(client?.password || '', 'Your Password')}
                    disabled={!client?.password}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={rotatePassword}
                    disabled={!client}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                How to use:
              </h4>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>Share your ID and password with support personnel</li>
                <li>They will enter these credentials in their admin panel</li>
                <li>You'll receive a connection request</li>
                <li>Accept the request to start the remote session</li>
                <li>You can end the session at any time</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Connection Status */}
        {client?.status === 'online' && !inCall && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Ready for connection</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* In Call Status */}
        {inCall && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Sharing your screen with support personnel
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={endCall}
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Incoming Call Dialog */}
        <AlertDialog open={!!incomingCall}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Incoming Support Request
              </AlertDialogTitle>
              <AlertDialogDescription>
                Support personnel wants to connect to your computer for remote assistance.
                They will be able to see your screen and with your permission, control your computer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={rejectCall}>
                Reject
              </AlertDialogCancel>
              <AlertDialogAction onClick={acceptCall}>
                Accept
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
