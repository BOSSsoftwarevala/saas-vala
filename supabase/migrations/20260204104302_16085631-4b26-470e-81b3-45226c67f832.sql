-- Create enum for support ticket status
CREATE TYPE public.support_status AS ENUM ('pending', 'open', 'resolved', 'escalated');

-- Create enum for message type
CREATE TYPE public.message_type AS ENUM ('text', 'voice', 'image');

-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  status support_status DEFAULT 'pending',
  assigned_staff_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  ip_hash TEXT
);

-- Create support messages table (non-editable, non-deletable by design)
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'staff')),
  message_type message_type DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  voice_duration INTEGER,
  is_internal_note BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create support audit logs
CREATE TABLE public.support_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.support_messages(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'staff', 'system')),
  details JSONB,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_prefix TEXT;
  next_number INTEGER;
BEGIN
  year_prefix := 'TKT-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 13) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.support_tickets
  WHERE ticket_number LIKE year_prefix || '%';
  
  RETURN year_prefix || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can create tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can update tickets"
ON public.support_tickets FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for support_messages
CREATE POLICY "Users can view messages in their tickets"
ON public.support_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id 
    AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  )
  AND (is_internal_note = false OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Users and staff can send messages"
ON public.support_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id 
    AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
    AND t.status IN ('open', 'escalated')
  )
);

-- RLS Policies for audit logs (read-only for staff)
CREATE POLICY "Staff can view audit logs"
ON public.support_audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert audit logs"
ON public.support_audit_logs FOR INSERT
WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;