-- Schedule periodic reminders for pending payment proof verification.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('payment-proof-reminder-job');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'payment-proof-reminder-job',
      '0 */2 * * *',
      $$
        SELECT net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/payment-proof-reminder',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body := '{"older_than_hours":6,"cooldown_hours":6,"limit":120}'::jsonb
        ) AS request_id;
      $$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $cron$;
