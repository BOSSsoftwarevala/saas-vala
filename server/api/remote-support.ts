import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Generate random 8-10 digit client ID
function generateClientId(): string {
  const length = Math.floor(Math.random() * 3) + 8 // 8-10 digits
  return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0')
}

// Generate random password
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Generate unique session ID
function generateSessionId(): string {
  return crypto.randomUUID()
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    switch (action) {
      case 'get-or-create-client': {
        // Get or create remote client for user with persistent ID
        const { client_id: persistentId, password: newPassword } = await req.json()
        
        let clientData
        
        if (persistentId) {
          // Try to find existing client with persistent ID
          const { data: existingClient } = await supabaseClient
            .from('remote_clients')
            .select('*')
            .eq('client_id', persistentId)
            .single()
          
          if (existingClient) {
            // Update existing client with new password and online status
            const { data } = await supabaseClient
              .from('remote_clients')
              .update({ 
                password: newPassword || generatePassword(),
                status: 'online', 
                last_seen: new Date().toISOString() 
              })
              .eq('id', existingClient.id)
              .select()
              .single()
            clientData = data
          } else {
            // Create new client with persistent ID
            const { data } = await supabaseClient
              .from('remote_clients')
              .insert({
                client_id: persistentId,
                password: newPassword || generatePassword(),
                user_id: user.id,
                status: 'online',
                last_seen: new Date().toISOString()
              })
              .select()
              .single()
            clientData = data
          }
        } else {
          // Fallback: Get existing client or create new random ID
          const { data: existingClient } = await supabaseClient
            .from('remote_clients')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (existingClient) {
            // Update status to online
            const { data } = await supabaseClient
              .from('remote_clients')
              .update({ 
                status: 'online', 
                last_seen: new Date().toISOString() 
              })
              .eq('id', existingClient.id)
              .select()
              .single()
            clientData = data
          } else {
            // Create new client with random ID
            let clientId = generateClientId()
            let password = generatePassword()
            
            // Ensure unique client_id
            let attempts = 0
            while (attempts < 10) {
              const { data: checkClient } = await supabaseClient
                .from('remote_clients')
                .select('client_id')
                .eq('client_id', clientId)
                .single()
              
              if (!checkClient) break
              clientId = generateClientId()
              attempts++
            }

            const { data } = await supabaseClient
              .from('remote_clients')
              .insert({
                client_id: clientId,
                password: password,
                user_id: user.id,
                status: 'online',
                last_seen: new Date().toISOString()
              })
              .select()
              .single()
            clientData = data
          }
        }

        return new Response(
          JSON.stringify({ success: true, data: clientData }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-password': {
        // Update password for existing client
        const { client_id, password } = await req.json()
        
        if (!client_id || !password) {
          return new Response(
            JSON.stringify({ error: 'Client ID and password required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data, error } = await supabaseClient
          .from('remote_clients')
          .update({ 
            password: password,
            last_seen: new Date().toISOString() 
          })
          .eq('client_id', client_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error || !data) {
          let errorMessage = 'Invalid client ID or password'
          let errorCode = 'INVALID_CREDENTIALS'
          
          if (error?.code === 'PGRST116') {
            errorMessage = 'Client ID not found - please check the ID and try again'
            errorCode = 'CLIENT_ID_NOT_FOUND'
          } else {
            // Check if client exists but wrong password
            const { data: clientExists } = await supabaseClient
              .from('remote_clients')
              .select('client_id, status')
              .eq('client_id', client_id)
              .single()
              
            if (clientExists) {
              if (clientExists.status === 'offline') {
                errorMessage = 'Client is currently offline - please ask them to go online first'
                errorCode = 'CLIENT_OFFLINE'
              } else {
                errorMessage = 'Incorrect password - please verify the password and try again'
                errorCode = 'WRONG_PASSWORD'
              }
            }
          }
          
          return new Response(
            JSON.stringify({ 
              error: errorMessage, 
              code: errorCode,
              client_id: client_id
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'validate-client': {
        // Validate client ID and password
        const { client_id, password } = await req.json()
        
        if (!client_id || !password) {
          return new Response(
            JSON.stringify({ 
              error: 'Client ID and password are required',
              code: 'MISSING_CREDENTIALS',
              details: {
                client_id: !client_id ? 'Client ID is missing' : null,
                password: !password ? 'Password is missing' : null
              }
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate client ID format
        if (!/^\d{8,10}$/.test(client_id)) {
          return new Response(
            JSON.stringify({ 
              error: 'Invalid Client ID format - must be 8-10 digits',
              code: 'INVALID_CLIENT_FORMAT',
              provided_id: client_id
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data, error } = await supabaseClient
          .from('remote_clients')
          .select('*')
          .eq('client_id', client_id)
          .eq('password', password)
          .eq('status', 'online')
          .single()

        if (error || !client) {
          return new Response(
            JSON.stringify({ error: 'Invalid client ID, password, or client offline' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, data: client }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create-session': {
        // Create new session with session lock
        const { client_id, admin_id, webrtc_offer } = await req.json()
        
        if (!client_id || !admin_id) {
          return new Response(
            JSON.stringify({ error: 'Client ID and Admin ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if client exists and is online
        const { data: client, error: clientError } = await supabaseClient
          .from('remote_clients')
          .select('*')
          .eq('client_id', client_id)
          .eq('status', 'online')
          .single()

        if (clientError || !client) {
          let errorMessage = 'Client not found or offline'
          let errorCode = 'CLIENT_NOT_FOUND'
          
          if (clientError?.code === 'PGRST116') {
            errorMessage = 'Invalid Client ID - no client found with this ID'
            errorCode = 'INVALID_CLIENT_ID'
          } else if (client?.status === 'offline') {
            errorMessage = 'Client is currently offline - please try again later'
            errorCode = 'CLIENT_OFFLINE'
          }
          
          return new Response(
            JSON.stringify({ 
              error: errorMessage, 
              code: errorCode,
              client_id: client_id 
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check for existing active sessions (session lock)
        const { data: existingSession, error: sessionError } = await supabaseClient
          .from('remote_sessions')
          .select('*')
          .eq('client_id', client_id)
          .in('status', ['active', 'connecting'])
          .single()

        if (existingSession && !sessionError) {
          // Session lock: Client already has an active session
          return new Response(
            JSON.stringify({ 
              error: 'Client is already in another session',
              code: 'SESSION_LOCKED',
              existing_session_id: existingSession.session_id,
              admin_id: existingSession.admin_id,
              session_status: existingSession.status
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
          
          // Option 2: Disconnect existing session and create new one
          /*
          await supabaseClient
            .from('remote_sessions')
            .update({ status: 'disconnected', end_time: new Date().toISOString() })
            .eq('id', existingSession.id)
          */
        }

        // Create new session
        const { data, error } = await supabaseClient
          .from('remote_sessions')
          .insert({
            session_id: generateSessionId(),
            client_id: client_id,
            admin_id: admin_id,
            status: 'connecting', // Start as connecting
            start_time: new Date().toISOString(),
            webrtc_offer: webrtc_offer
          })
          .select()
          .single()

        if (error) {
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create session - please try again',
              code: 'SESSION_CREATE_FAILED',
              details: error.message
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-session': {
        // Update session with WebRTC data
        const { session_id, webrtc_answer, ice_candidates } = await req.json()
        
        if (!session_id) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const updateData: any = {}
        if (webrtc_answer) updateData.webrtc_answer = webrtc_answer
        if (ice_candidates) updateData.ice_candidates = ice_candidates

        const { data: session } = await supabaseClient
          .from('remote_sessions')
          .update(updateData)
          .eq('session_id', session_id)
          .eq('admin_id', user.id)
          .select()
          .single()

        return new Response(
          JSON.stringify({ success: true, data: session }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'end-session': {
        // End session
        const { session_id } = await req.json()
        
        if (!session_id) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: session } = await supabaseClient
          .from('remote_sessions')
          .update({ 
            status: 'disconnected', 
            end_time: new Date().toISOString() 
          })
          .eq('session_id', session_id)
          .or(`admin_id.eq.${user.id},client_id.in.(SELECT client_id FROM remote_clients WHERE user_id = '${user.id}')`)
          .select()
          .single()

        return new Response(
          JSON.stringify({ success: true, data: session }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-status': {
        // Update client status
        const { status } = await req.json()
        
        if (!status || !['online', 'offline'].includes(status)) {
          return new Response(
            JSON.stringify({ error: 'Valid status required (online/offline)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: client } = await supabaseClient
          .from('remote_clients')
          .update({ 
            status, 
            last_seen: new Date().toISOString() 
          })
          .eq('user_id', user.id)
          .select()
          .single()

        return new Response(
          JSON.stringify({ success: true, data: client }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Remote support API error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
