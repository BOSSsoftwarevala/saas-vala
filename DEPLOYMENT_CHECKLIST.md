# Server Management System - Deployment Checklist

## Pre-Deployment (Local Testing)

- [ ] Review database migration: `supabase/migrations/20260411000000_server_management_premium.sql`
- [ ] Review backend code: `supabase/functions/api-gateway/server-management-v2.ts`
- [ ] Review API routing: `supabase/functions/api-gateway/index.ts` (new case statement)
- [ ] Review frontend API: `src/lib/api.ts` (new serverManagementApi)
- [ ] Review frontend hook: `src/hooks/useServerManagement.ts`
- [ ] Review configuration: `src/config/serverManagementConfig.ts`
- [ ] Check TypeScript compilation: `npm run build`
- [ ] Run linter: `npm run lint`

## Database Setup

- [ ] Apply migration locally:
  ```bash
  cd supabase
  supabase db push
  ```
- [ ] Test RLS policies with test user
- [ ] Verify table creation:
  ```sql
  select tablename from pg_tables where schemaname='public' and tablename like 'server_%';
  ```
- [ ] Test data isolation (user should only see own servers)

## Environment Configuration

- [ ] Copy `.env.server-management.example` → `.env.local`
- [ ] Set `VITE_SUPABASE_URL` (from Supabase dashboard)
- [ ] Set `VITE_SUPABASE_PUBLISHABLE_KEY` (from Supabase dashboard)
- [ ] Set `OPENAI_API_KEY` (from OpenAI dashboard)
- [ ] Verify no secrets committed to git

## Backend Deployment

- [ ] Deploy Edge Functions:
  ```bash
  supabase functions deploy api-gateway
  ```
- [ ] Verify deployment: Check Supabase Functions dashboard
- [ ] Test API endpoint:
  ```bash
  curl -X GET https://your-project.supabase.co/functions/v1/api-gateway/server-management/{id}/metrics/latest \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- [ ] Check function logs for errors

## Frontend Integration

- [ ] Add `serverManagementApi` import to your components
- [ ] Add `useServerManagement` hook to server page
- [ ] Test metric fetching
- [ ] Test billing display
- [ ] Test server controls
- [ ] Test AI analysis trigger
- [ ] Test error handling

## Agent Setup

- [ ] Deploy agent script to test server
- [ ] Configure agent environment variables:
  - API_URL
  - SERVER_ID
  - AGENT_API_TOKEN
- [ ] Start agent process
- [ ] Verify agent registration:
  ```sql
  select * from public.server_agents where server_id = 'YOUR_ID';
  ```
- [ ] Verify heartbeat updates (should have recent timestamp)
- [ ] Verify metrics being recorded:
  ```sql
  select * from public.server_metrics 
  where server_id = 'YOUR_ID' 
  order by recorded_at desc 
  limit 5;
  ```

## AI Analysis Testing

- [ ] Trigger manual analysis
- [ ] Verify OpenAI API key is working
- [ ] Check AI analysis results in database:
  ```sql
  select response, recommendations from public.server_ai_analysis 
  where server_id = 'YOUR_ID' 
  order by analyzed_at desc 
  limit 1;
  ```
- [ ] Verify recommendations are formatted correctly

## Billing System Testing

- [ ] Create test billing cycle:
  ```bash
  curl -X POST https://your-project.supabase.co/functions/v1/api-gateway/server-management/{id}/billing/create-cycle
  ```
- [ ] Verify billing record:
  ```sql
  select * from public.server_billing 
  where server_id = 'YOUR_ID' 
  order by created_at desc 
  limit 1;
  ```
- [ ] Test marking as paid
- [ ] Test billing history retrieval

## Security Testing

- [ ] Verify user can't access other users' servers:
  ```sql
  select * from public.server_metrics 
  where not exists (
    select 1 from public.servers s 
    where s.id = server_metrics.server_id 
    and s.created_by = auth.uid()
  );
  ```
  (Should return 0 rows)
- [ ] Test SSH key encryption
- [ ] Test RLS on all tables
- [ ] Test JWT authentication requirement
- [ ] Verify rate limiting works

## Logging Verification

- [ ] Perform operations (start/stop/restart)
- [ ] Check logs recorded:
  ```sql
  select action, status, message, created_at 
  from public.server_logs 
  where server_id = 'YOUR_ID' 
  order by created_at desc 
  limit 10;
  ```
- [ ] Verify all details captured

## Performance Testing

- [ ] Load test metrics endpoint with 100+ requests
- [ ] Monitor API response times (should be <200ms p99)
- [ ] Check database performance
- [ ] Monitor memory usage on agent
- [ ] Check CPU usage during AI analysis

## UI/UX Testing

- [ ] Metric cards display correctly
- [ ] Real-time updates every 30 seconds
- [ ] Agent status shows correct status
- [ ] Billing information displays correctly
- [ ] AI recommendations format properly
- [ ] Logs update automatically
- [ ] Server controls respond immediately
- [ ] Loading states show appropriately
- [ ] Error messages clear and helpful

## Integration Testing

- [ ] Hook integration with Servers page
- [ ] Multiple servers display simultaneously
- [ ] Switching between servers works smoothly
- [ ] Historical metrics load correctly
- [ ] AI analysis caching works
- [ ] No memory leaks in component

## Browser Testing

- [ ] Chrome/Edge: ✓
- [ ] Firefox: ✓
- [ ] Safari: ✓
- [ ] Mobile Chrome: ✓
- [ ] Mobile Safari: ✓

## Documentation Review

- [ ] SERVER_MANAGEMENT_SETUP.md is accurate
- [ ] SERVER_MANAGEMENT_INTEGRATION.md is complete
- [ ] API endpoints documented correctly
- [ ] Configuration options documented
- [ ] Troubleshooting guide covers common issues

## Backup & Recovery Testing

- [ ] Database backup includes new tables
- [ ] Restore test successful
- [ ] Agent can reconnect after outage
- [ ] Metrics resume after downtime

## Production Deployment

- [ ] Code reviewed by team member
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] All tests passing
- [ ] Documentation updated for team
- [ ] Rollback plan documented

## Post-Deployment Monitoring

- [ ] Monitor API error rates
- [ ] Monitor database performance
- [ ] Monitor agent connectivity
- [ ] Monitor AI analysis usage
- [ ] Monitor user feedback on new features

## Rollback Plan (if needed)

- [ ] Remove `case 'server-management'` from api-gateway routing
- [ ] Disable new Edge Function
- [ ] Remove serverManagementApi imports from frontend
- [ ] Remove hook usage from components
- [ ] Keep database migration (safe, additive only)
- [ ] Restore previous API Gateway version

## Success Criteria

✅ All metrics displaying in real-time
✅ AI analysis working and showing recommendations
✅ Billing system calculating correctly
✅ Agents connecting and sending heartbeats
✅ SSH keys encrypting properly
✅ SSL certificates tracking correctly
✅ Logs recording all operations
✅ No existing functionality broken
✅ No UI changes visible to users
✅ Performance meets requirements

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Local Testing | 2-4 hours |
| Agent Setup | 1-2 hours |
| API Testing | 2-3 hours |
| UI Integration | 2-3 hours |
| Security Testing | 2 hours |
| Performance Testing | 1-2 hours |
| Production Deployment | 1 hour |
| Post-Deployment Monitoring | Ongoing |

**Total**: ~14-21 hours depending on team size

## Support & Escalation

- Database issues: Contact Supabase support
- API issues: Check Edge Function logs
- Frontend issues: Check browser console
- Agent issues: Check agent logs on server
- AI analysis issues: Verify OpenAI API key
- Billing issues: Verify stripe/payment integration

## Contact & Resources

- Documentation: See SERVER_MANAGEMENT_*.md files
- Code: `/supabase/functions/api-gateway/server-management-v2.ts`
- Database: `/supabase/migrations/20260411000000_*`
- Frontend: `/src/hooks/useServerManagement.ts`
- Config: `/src/config/serverManagementConfig.ts`

---

**Prepared By**: AI Assistant
**Date**: April 11, 2026
**Status**: Ready for Deployment
