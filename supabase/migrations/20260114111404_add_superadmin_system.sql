-- ============================================
-- Migration: Add Superadmin System
-- Description: Adds global superadmin role, audit logging, and client role support
-- ============================================

-- ============================================
-- 1. SUPERADMINS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,

  -- One superadmin entry per user
  CONSTRAINT unique_superadmin_user UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_superadmins_user_id ON public.superadmins(user_id);
CREATE INDEX IF NOT EXISTS idx_superadmins_active ON public.superadmins(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only superadmins can view/manage superadmins
CREATE POLICY "Superadmins can view all superadmins"
  ON public.superadmins
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM public.superadmins WHERE is_active = true
    )
  );

CREATE POLICY "Superadmins can manage superadmins"
  ON public.superadmins
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.superadmins WHERE is_active = true
    )
  );

-- ============================================
-- 2. SUPERADMIN AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.superadmin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  target_studio_id UUID REFERENCES public.studios(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_superadmin ON public.superadmin_audit_log(superadmin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.superadmin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.superadmin_audit_log(action);

-- Enable RLS
ALTER TABLE public.superadmin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only superadmins can view audit log
CREATE POLICY "Superadmins can view audit log"
  ON public.superadmin_audit_log
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.superadmins WHERE is_active = true
    )
  );

-- RLS Policy: Audit log entries are immutable after creation
CREATE POLICY "Superadmins can create audit entries"
  ON public.superadmin_audit_log
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.superadmins WHERE is_active = true
    )
  );

-- ============================================
-- 3. UPDATE STUDIO_MEMBERS ROLE CONSTRAINT
-- ============================================

-- Drop existing CHECK constraint
ALTER TABLE public.studio_members
  DROP CONSTRAINT IF EXISTS studio_members_role_check;

-- Add new CHECK constraint with 'client' role
ALTER TABLE public.studio_members
  ADD CONSTRAINT studio_members_role_check
  CHECK (role IN ('owner', 'admin', 'collaborator', 'client'));

-- ============================================
-- 4. SEED INITIAL SUPERADMIN
-- ============================================

-- Insert framirez@contablix.ar as initial superadmin
-- This will only work if the user has logged in at least once
INSERT INTO public.superadmins (user_id, notes, granted_by)
SELECT
  id,
  'Initial superadmin - Project creator',
  id  -- Self-granted
FROM auth.users
WHERE email = 'framirez@contablix.ar'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.superadmins IS 'Global superadmin users with full system access';
COMMENT ON TABLE public.superadmin_audit_log IS 'Immutable audit log of all superadmin actions';
COMMENT ON COLUMN public.studio_members.role IS 'User role within studio: owner, admin, collaborator, or client (read-only)';
