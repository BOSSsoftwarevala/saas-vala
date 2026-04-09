-- Support RBAC strict enforcement (API + DB hardening, no UI changes)

ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.chat_channel_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  assignee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_role TEXT NOT NULL DEFAULT 'agent',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, assignee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_assignments_channel
  ON public.chat_channel_assignments(channel_id, active);

CREATE INDEX IF NOT EXISTS idx_chat_channel_assignments_assignee
  ON public.chat_channel_assignments(assignee_user_id, active);

ALTER TABLE public.chat_channel_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.chat_actor_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'anonymous';
  END IF;

  IF public.has_role(p_user_id, 'super_admin') THEN
    RETURN 'super_admin';
  ELSIF public.has_role(p_user_id, 'admin') THEN
    RETURN 'admin';
  ELSIF public.has_role(p_user_id, 'support') THEN
    RETURN 'support';
  ELSIF public.has_role(p_user_id, 'reseller') OR public.has_role(p_user_id, 'master_reseller') THEN
    RETURN 'reseller';
  END IF;

  RETURN 'user';
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_can_access_channel(
  p_channel_id UUID,
  p_action TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_channel RECORD;
  v_is_member BOOLEAN;
  v_is_assigned BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_channel_id IS NULL OR p_action IS NULL THEN
    RETURN FALSE;
  END IF;

  v_role := public.chat_actor_role(p_user_id);

  SELECT id, channel_type, is_private, is_internal, owner_user_id
  INTO v_channel
  FROM public.chat_channels
  WHERE id = p_channel_id;

  IF v_channel.id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.chat_channel_members cm
    WHERE cm.channel_id = p_channel_id
      AND cm.user_id = p_user_id
  ) INTO v_is_member;

  SELECT EXISTS (
    SELECT 1
    FROM public.chat_channel_assignments ca
    WHERE ca.channel_id = p_channel_id
      AND ca.assignee_user_id = p_user_id
      AND ca.active = true
  ) INTO v_is_assigned;

  IF v_role IN ('support', 'reseller') THEN
    IF p_action IN ('read', 'write') THEN
      RETURN v_is_member OR v_is_assigned;
    ELSIF p_action = 'moderate' THEN
      RETURN v_is_assigned OR EXISTS (
        SELECT 1
        FROM public.chat_channel_members cm
        WHERE cm.channel_id = p_channel_id
          AND cm.user_id = p_user_id
          AND cm.role = 'admin'
      );
    ELSIF p_action IN ('manage', 'settings') THEN
      RETURN FALSE;
    ELSIF p_action = 'delete' THEN
      RETURN v_is_assigned;
    END IF;
    RETURN FALSE;
  END IF;

  -- Default user/client role
  IF p_action IN ('manage', 'settings', 'moderate') THEN
    RETURN FALSE;
  END IF;

  IF v_channel.is_internal THEN
    RETURN FALSE;
  END IF;

  IF p_action IN ('read', 'write', 'delete') THEN
    IF v_channel.owner_user_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    -- End users can only see/join their own private/direct spaces.
    RETURN v_is_member
      AND v_channel.channel_type IN ('direct', 'private', 'ticket')
      AND (v_channel.channel_type <> 'ticket' OR v_channel.owner_user_id = p_user_id);
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_can_create_channel(
  p_channel_type TEXT,
  p_is_internal BOOLEAN,
  p_owner_user_id UUID,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_created_by IS NULL THEN
    RETURN FALSE;
  END IF;

  v_role := public.chat_actor_role(p_created_by);

  IF v_role IN ('super_admin', 'admin') THEN
    RETURN TRUE;
  END IF;

  IF v_role IN ('support', 'reseller') THEN
    RETURN p_is_internal = false
      AND p_channel_type IN ('public', 'private', 'direct', 'ticket');
  END IF;

  -- user/client can only create own direct/ticket channels and never internal channels
  RETURN p_is_internal = false
    AND p_channel_type IN ('direct', 'ticket')
    AND COALESCE(p_owner_user_id, p_created_by) = p_created_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_log_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_name TEXT := TG_TABLE_NAME;
  v_action TEXT := lower(TG_OP);
  v_old JSONB;
  v_new JSONB;
  v_record_id TEXT;
  v_channel_id TEXT;
  v_role TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := COALESCE((to_jsonb(NEW)->>'id'), '');
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id'), '');
  ELSE
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := COALESCE((to_jsonb(OLD)->>'id'), '');
  END IF;

  v_channel_id := COALESCE(
    v_new->>'channel_id',
    v_old->>'channel_id',
    CASE WHEN v_table_name = 'chat_channels' THEN COALESCE(v_new->>'id', v_old->>'id') ELSE NULL END
  );

  v_role := public.chat_actor_role(auth.uid());

  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      role_name,
      action,
      action_type,
      table_name,
      record_id,
      event_source,
      system_generated,
      is_sensitive_action,
      old_value,
      new_value,
      request_id,
      trace_id,
      chain_id,
      api_path,
      http_method,
      metadata_ext
    ) VALUES (
      auth.uid(),
      v_role,
      upper(v_action || '_' || v_table_name),
      upper(v_action),
      v_table_name,
      v_record_id,
      'support_rbac',
      false,
      CASE WHEN v_action IN ('delete', 'update') THEN true ELSE false END,
      v_old,
      v_new,
      gen_random_uuid()::text,
      gen_random_uuid()::text,
      COALESCE(v_channel_id, gen_random_uuid()::text),
      '/support',
      upper(v_action),
      jsonb_build_object('channel_id', v_channel_id, 'actor_role', v_role)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block business operation due to audit insertion issues.
    NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_or_get_direct_channel(
  p_other_user UUID,
  p_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
  v_other_role TEXT;
  v_pair_key TEXT;
  v_channel_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_other_user IS NULL OR p_other_user = v_actor THEN
    RAISE EXCEPTION 'Invalid direct channel target';
  END IF;

  v_actor_role := public.chat_actor_role(v_actor);
  v_other_role := public.chat_actor_role(p_other_user);

  -- End users can DM only support-side roles, not arbitrary users.
  IF v_actor_role = 'user' AND v_other_role NOT IN ('support', 'reseller', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Users can only open DMs with support team';
  END IF;

  v_pair_key := LEAST(v_actor::text, p_other_user::text) || ':' || GREATEST(v_actor::text, p_other_user::text);

  SELECT id INTO v_channel_id
  FROM public.chat_channels
  WHERE channel_type = 'direct' AND dm_pair_key = v_pair_key
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    INSERT INTO public.chat_channels(
      name,
      description,
      channel_type,
      created_by,
      owner_user_id,
      is_private,
      is_internal,
      dm_pair_key
    )
    VALUES (
      COALESCE(NULLIF(p_label, ''), 'direct-message'),
      'Direct message channel',
      'direct',
      v_actor,
      CASE WHEN v_actor_role = 'user' THEN v_actor ELSE NULL END,
      true,
      false,
      v_pair_key
    )
    RETURNING id INTO v_channel_id;
  END IF;

  INSERT INTO public.chat_channel_members(channel_id, user_id, role)
  VALUES (v_channel_id, v_actor, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  INSERT INTO public.chat_channel_members(channel_id, user_id, role)
  VALUES (v_channel_id, p_other_user, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_channel_id;
END;
$$;

-- Replace channel visibility policy with strict RBAC gate.
DROP POLICY IF EXISTS "View channels" ON public.chat_channels;
CREATE POLICY "View channels"
  ON public.chat_channels
  FOR SELECT
  TO authenticated
  USING (public.chat_can_access_channel(id, 'read', auth.uid()));

DROP POLICY IF EXISTS "Create channels" ON public.chat_channels;
CREATE POLICY "Create channels"
  ON public.chat_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.chat_can_create_channel(
      channel_type,
      COALESCE(is_internal, false),
      owner_user_id,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "Update channels" ON public.chat_channels;
CREATE POLICY "Update channels"
  ON public.chat_channels
  FOR UPDATE
  TO authenticated
  USING (public.chat_can_access_channel(id, 'manage', auth.uid()))
  WITH CHECK (public.chat_can_access_channel(id, 'manage', auth.uid()));

-- Membership policies
DROP POLICY IF EXISTS "View members" ON public.chat_channel_members;
CREATE POLICY "View members"
  ON public.chat_channel_members
  FOR SELECT
  TO authenticated
  USING (public.chat_can_access_channel(channel_id, 'read', auth.uid()));

DROP POLICY IF EXISTS "Join channels" ON public.chat_channel_members;
CREATE POLICY "Join channels"
  ON public.chat_channel_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND public.chat_can_access_channel(channel_id, 'read', auth.uid())
    )
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  );

DROP POLICY IF EXISTS "Update membership" ON public.chat_channel_members;
CREATE POLICY "Update membership"
  ON public.chat_channel_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  );

DROP POLICY IF EXISTS "Leave channels" ON public.chat_channel_members;
CREATE POLICY "Leave channels"
  ON public.chat_channel_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  );

-- Message visibility + action policies
DROP POLICY IF EXISTS "View messages" ON public.chat_messages;
CREATE POLICY "View messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (public.chat_can_access_channel(channel_id, 'read', auth.uid()));

DROP POLICY IF EXISTS "Send messages" ON public.chat_messages;
CREATE POLICY "Send messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.chat_can_access_channel(channel_id, 'write', auth.uid())
  );

DROP POLICY IF EXISTS "Edit own messages" ON public.chat_messages;
CREATE POLICY "Edit own messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  );

CREATE POLICY "Delete message control"
  ON public.chat_messages
  FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  );

-- Typing policies linked to channel write access
DROP POLICY IF EXISTS "View typing" ON public.chat_typing;
CREATE POLICY "View typing"
  ON public.chat_typing
  FOR SELECT
  TO authenticated
  USING (public.chat_can_access_channel(channel_id, 'read', auth.uid()));

DROP POLICY IF EXISTS "Set typing" ON public.chat_typing;
CREATE POLICY "Set typing"
  ON public.chat_typing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.chat_can_access_channel(channel_id, 'write', auth.uid())
  );

DROP POLICY IF EXISTS "Clear typing" ON public.chat_typing;
CREATE POLICY "Clear typing"
  ON public.chat_typing
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'manage', auth.uid())
  );

-- Assignment policies
DROP POLICY IF EXISTS "Manage channel assignments" ON public.chat_channel_assignments;
CREATE POLICY "Manage channel assignments"
  ON public.chat_channel_assignments
  FOR ALL
  TO authenticated
  USING (
    public.chat_can_access_channel(channel_id, 'manage', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
  )
  WITH CHECK (
    public.chat_can_access_channel(channel_id, 'manage', auth.uid())
    OR public.chat_can_access_channel(channel_id, 'moderate', auth.uid())
  );

-- Ensure file/receipt visibility follows channel read access.
DROP POLICY IF EXISTS "View own message receipts" ON public.chat_message_receipts;
CREATE POLICY "View own message receipts"
  ON public.chat_message_receipts
  FOR SELECT
  TO authenticated
  USING (public.chat_can_access_channel(channel_id, 'read', auth.uid()));

DROP POLICY IF EXISTS "Insert own message receipts" ON public.chat_message_receipts;
CREATE POLICY "Insert own message receipts"
  ON public.chat_message_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.chat_can_access_channel(channel_id, 'write', auth.uid())
  );

DROP POLICY IF EXISTS "Update own message receipts" ON public.chat_message_receipts;
CREATE POLICY "Update own message receipts"
  ON public.chat_message_receipts
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.chat_can_access_channel(channel_id, 'read', auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.chat_can_access_channel(channel_id, 'read', auth.uid())
  );

DROP POLICY IF EXISTS "View channel files" ON public.chat_message_files;
CREATE POLICY "View channel files"
  ON public.chat_message_files
  FOR SELECT
  TO authenticated
  USING (public.chat_can_access_channel(channel_id, 'read', auth.uid()));

DROP POLICY IF EXISTS "Insert own channel files" ON public.chat_message_files;
CREATE POLICY "Insert own channel files"
  ON public.chat_message_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND public.chat_can_access_channel(channel_id, 'write', auth.uid())
  );

-- Audit trigger coverage for support actions.
DROP TRIGGER IF EXISTS trg_chat_audit_channels ON public.chat_channels;
CREATE TRIGGER trg_chat_audit_channels
AFTER INSERT OR UPDATE OR DELETE ON public.chat_channels
FOR EACH ROW EXECUTE FUNCTION public.chat_log_action();

DROP TRIGGER IF EXISTS trg_chat_audit_messages ON public.chat_messages;
CREATE TRIGGER trg_chat_audit_messages
AFTER INSERT OR UPDATE OR DELETE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_log_action();

DROP TRIGGER IF EXISTS trg_chat_audit_members ON public.chat_channel_members;
CREATE TRIGGER trg_chat_audit_members
AFTER INSERT OR UPDATE OR DELETE ON public.chat_channel_members
FOR EACH ROW EXECUTE FUNCTION public.chat_log_action();

DROP TRIGGER IF EXISTS trg_chat_audit_typing ON public.chat_typing;
CREATE TRIGGER trg_chat_audit_typing
AFTER INSERT OR UPDATE OR DELETE ON public.chat_typing
FOR EACH ROW EXECUTE FUNCTION public.chat_log_action();

DROP TRIGGER IF EXISTS trg_chat_audit_receipts ON public.chat_message_receipts;
CREATE TRIGGER trg_chat_audit_receipts
AFTER INSERT OR UPDATE OR DELETE ON public.chat_message_receipts
FOR EACH ROW EXECUTE FUNCTION public.chat_log_action();

DROP TRIGGER IF EXISTS trg_chat_audit_files ON public.chat_message_files;
CREATE TRIGGER trg_chat_audit_files
AFTER INSERT OR UPDATE OR DELETE ON public.chat_message_files
FOR EACH ROW EXECUTE FUNCTION public.chat_log_action();

DROP TRIGGER IF EXISTS trg_chat_audit_assignments ON public.chat_channel_assignments;
CREATE TRIGGER trg_chat_audit_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.chat_channel_assignments
FOR EACH ROW EXECUTE FUNCTION public.chat_log_action();
