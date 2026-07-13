-- ============================================================
-- CopSight AI — Supabase Row-Level Security (RLS) Migration
-- ============================================================
-- PURPOSE:
--   Fixes two CRITICAL Supabase security alerts:
--     1. 'Table publicly accessible'         -> rls_disabled_in_public
--     2. 'Sensitive data publicly accessible' -> sensitive_columns_exposed
--
-- ARCHITECTURE NOTE:
--   Node.js backend connects via Sequelize with direct DB credentials
--   (postgres / service_role). In Supabase, service_role has BYPASSRLS=true
--   by default, so the backend is 100% unaffected after this migration.
--
-- SAFE TO RE-RUN: the DO block skips tables that don't exist yet.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> Paste entire script -> Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Revoke all REST API access (anon + authenticated roles)
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;

-- ─────────────────────────────────────────────────────────────
-- STEPS 2-4: Enable RLS + Force RLS + Deny-all policies
-- Dynamic DO block: skips any table that does not exist yet.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users',
    'cases',
    'devices',
    'data_sources',
    'processing_jobs',
    'audit_log',
    'case_queries',
    'evidence_bookmarks',
    'entity_tags',
    'case_reports',
    'case_access_log',
    'cross_case_links',
    'notifications',
    'alerts',
    'alert_rules',
    'case_shared_entities'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      RAISE NOTICE 'Table public.% does not exist — skipping', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS deny_anon_%I ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS deny_authenticated_%I ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY deny_anon_%I ON public.%I AS RESTRICTIVE FOR ALL TO anon USING (false)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY deny_authenticated_%I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (false)',
      tbl, tbl
    );

    RAISE NOTICE 'RLS secured: %', tbl;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 5 (Optional): Verify
-- ─────────────────────────────────────────────────────────────
-- Run these separately in SQL Editor to confirm:
--
-- SELECT tablename, rowsecurity AS rls_on, forcesecurity AS force_rls
-- FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- SET ROLE anon; SELECT count(*) FROM users; RESET ROLE;
-- Expected: 0 rows (anon locked out)

-- ─────────────────────────────────────────────────────────────
-- RESULT
-- ─────────────────────────────────────────────────────────────
-- v anon + authenticated roles: all grants revoked
-- v RLS enabled + forced on every existing table
-- v RESTRICTIVE deny-all policies applied
-- v Tables not yet created: safely skipped (NOTICE logged)
-- v service_role (Node.js backend): BYPASSRLS=true, works normally
-- v Resolves both Supabase CRITICAL security alerts
-- ─────────────────────────────────────────────────────────────
