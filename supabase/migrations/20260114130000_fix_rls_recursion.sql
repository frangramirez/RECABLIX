-- Migration: Fix RLS infinite recursion and add superadmin policies
-- Issue: Policies on studio_members and superadmins reference themselves causing infinite recursion
-- Solution: Use SECURITY DEFINER functions to break the recursion cycle

-- =============================================
-- STEP 1: Create helper functions (SECURITY DEFINER)
-- These bypass RLS when checking membership
-- =============================================

-- Function to get studio IDs for a user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_studio_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT studio_id FROM studio_members WHERE user_id = uid
$$;

-- Function to check if user is active superadmin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_active_superadmin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM superadmins WHERE user_id = uid AND is_active = true
  )
$$;

-- =============================================
-- STEP 2: Fix studio_members policies
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view studio members" ON public.studio_members;
DROP POLICY IF EXISTS "Admins can add studio members" ON public.studio_members;
DROP POLICY IF EXISTS "Owners can manage members" ON public.studio_members;

-- Recreate without recursion
-- SELECT: Users can view members of studios they belong to
CREATE POLICY "Users can view studio members" ON public.studio_members
  FOR SELECT USING (
    studio_id IN (SELECT get_user_studio_ids(auth.uid()))
    OR is_active_superadmin(auth.uid())
  );

-- INSERT: Owners/admins can add members, OR first member (owner) can be added
CREATE POLICY "Admins can add studio members" ON public.studio_members
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT sid FROM get_user_studio_ids(auth.uid()) sid
      WHERE EXISTS (
        SELECT 1 FROM studio_members sm
        WHERE sm.studio_id = sid
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
      )
    )
    OR NOT EXISTS (SELECT 1 FROM studio_members WHERE studio_id = studio_members.studio_id)
    OR is_active_superadmin(auth.uid())
  );

-- DELETE: Owners can delete other members (but not themselves)
CREATE POLICY "Owners can manage members" ON public.studio_members
  FOR DELETE USING (
    (
      studio_id IN (
        SELECT sid FROM get_user_studio_ids(auth.uid()) sid
        WHERE EXISTS (
          SELECT 1 FROM studio_members sm
          WHERE sm.studio_id = sid
          AND sm.user_id = auth.uid()
          AND sm.role = 'owner'
        )
      )
      AND user_id != auth.uid()
    )
    OR is_active_superadmin(auth.uid())
  );

-- =============================================
-- STEP 3: Fix superadmins policies
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Superadmins can view all superadmins" ON public.superadmins;
DROP POLICY IF EXISTS "Superadmins can manage superadmins" ON public.superadmins;

-- Recreate without recursion using the helper function
CREATE POLICY "Superadmins can view all superadmins" ON public.superadmins
  FOR SELECT USING (is_active_superadmin(auth.uid()));

CREATE POLICY "Superadmins can manage superadmins" ON public.superadmins
  FOR ALL USING (is_active_superadmin(auth.uid()));

-- =============================================
-- STEP 4: Add superadmin policies to studios
-- =============================================

-- Drop and recreate studios policies to include superadmin access
DROP POLICY IF EXISTS "Users can view their studios" ON public.studios;
DROP POLICY IF EXISTS "Owners can update studios" ON public.studios;

CREATE POLICY "Users can view their studios" ON public.studios
  FOR SELECT USING (
    id IN (SELECT get_user_studio_ids(auth.uid()))
    OR is_active_superadmin(auth.uid())
  );

CREATE POLICY "Owners can update studios" ON public.studios
  FOR UPDATE USING (
    id IN (
      SELECT sid FROM get_user_studio_ids(auth.uid()) sid
      WHERE EXISTS (
        SELECT 1 FROM studio_members sm
        WHERE sm.studio_id = sid
        AND sm.user_id = auth.uid()
        AND sm.role = 'owner'
      )
    )
    OR is_active_superadmin(auth.uid())
  );

-- =============================================
-- STEP 5: Add superadmin policies to clients
-- =============================================

DROP POLICY IF EXISTS "Users can view studio clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create studio clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update studio clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete studio clients" ON public.clients;

CREATE POLICY "Users can view studio clients" ON public.clients
  FOR SELECT USING (
    studio_id IN (SELECT get_user_studio_ids(auth.uid()))
    OR is_active_superadmin(auth.uid())
  );

CREATE POLICY "Users can create studio clients" ON public.clients
  FOR INSERT WITH CHECK (
    studio_id IN (SELECT get_user_studio_ids(auth.uid()))
    OR is_active_superadmin(auth.uid())
  );

CREATE POLICY "Users can update studio clients" ON public.clients
  FOR UPDATE USING (
    studio_id IN (SELECT get_user_studio_ids(auth.uid()))
    OR is_active_superadmin(auth.uid())
  );

CREATE POLICY "Admins can delete studio clients" ON public.clients
  FOR DELETE USING (
    studio_id IN (
      SELECT sid FROM get_user_studio_ids(auth.uid()) sid
      WHERE EXISTS (
        SELECT 1 FROM studio_members sm
        WHERE sm.studio_id = sid
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
      )
    )
    OR is_active_superadmin(auth.uid())
  );

-- =============================================
-- STEP 6: Update related tables (reca_client_data, reca_transactions)
-- These inherit access through clients, but we add superadmin override
-- =============================================

DROP POLICY IF EXISTS "reca_client_data_via_client" ON public.reca_client_data;

CREATE POLICY "reca_client_data_via_client" ON public.reca_client_data
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      WHERE c.studio_id IN (SELECT get_user_studio_ids(auth.uid()))
    )
    OR is_active_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "reca_transactions_via_client" ON public.reca_transactions;

CREATE POLICY "reca_transactions_via_client" ON public.reca_transactions
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      WHERE c.studio_id IN (SELECT get_user_studio_ids(auth.uid()))
    )
    OR is_active_superadmin(auth.uid())
  );

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON FUNCTION public.get_user_studio_ids IS 'Returns studio IDs for a user. SECURITY DEFINER to bypass RLS recursion.';
COMMENT ON FUNCTION public.is_active_superadmin IS 'Checks if user is active superadmin. SECURITY DEFINER to bypass RLS recursion.';
