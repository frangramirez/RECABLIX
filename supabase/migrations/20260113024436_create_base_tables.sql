-- ============================================
-- FINBLIX - Base Tables Migration
-- Version: 000
-- Description: Creates base tables for studios and members
-- ============================================

-- ============================================
-- STUDIOS TABLE (Estudios Contables)
-- ============================================
CREATE TABLE IF NOT EXISTS public.studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Slug validation: lowercase, alphanumeric with hyphens
  CONSTRAINT valid_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' OR slug ~ '^[a-z0-9]$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_studios_slug ON public.studios(slug);
CREATE INDEX IF NOT EXISTS idx_studios_name ON public.studios USING gin(to_tsvector('spanish', name));

-- ============================================
-- STUDIO_MEMBERS TABLE (Miembros del Estudio)
-- ============================================
CREATE TABLE IF NOT EXISTS public.studio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'admin', 'collaborator')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique user per studio
  CONSTRAINT unique_member_per_studio UNIQUE (studio_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_studio_members_studio_id ON public.studio_members(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_members_user_id ON public.studio_members(user_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_members ENABLE ROW LEVEL SECURITY;

-- Studios: Users can view studios they belong to
CREATE POLICY "Users can view their studios" ON public.studios
  FOR SELECT USING (
    id IN (
      SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()
    )
  );

-- Studios: Owners can update their studios
CREATE POLICY "Owners can update studios" ON public.studios
  FOR UPDATE USING (
    id IN (
      SELECT studio_id FROM public.studio_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Studios: Any authenticated user can create a studio (they become owner)
CREATE POLICY "Users can create studios" ON public.studios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Studio members: Users can view members of their studios
CREATE POLICY "Users can view studio members" ON public.studio_members
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()
    )
  );

-- Studio members: Owners and admins can add members
CREATE POLICY "Admins can add studio members" ON public.studio_members
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.studio_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    -- Allow first member (owner) to be added
    NOT EXISTS (SELECT 1 FROM public.studio_members WHERE studio_id = studio_members.studio_id)
  );

-- Studio members: Owners can manage all members, admins can manage collaborators
CREATE POLICY "Owners can manage members" ON public.studio_members
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
    AND user_id != auth.uid() -- Can't delete yourself
  );

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER update_studios_updated_at
  BEFORE UPDATE ON public.studios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
