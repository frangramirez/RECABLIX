-- Complete RLS policies for RECABLIX master tables
-- Problem: Only SELECT policy exists, INSERT/UPDATE/DELETE blocked for superadmins
-- Solution: Add management policies using is_active_superadmin()

-- =============================================
-- reca_periods - Períodos de recategorización
-- =============================================
CREATE POLICY "superadmins_manage_reca_periods" ON public.reca_periods
  FOR ALL
  USING (is_active_superadmin(auth.uid()))
  WITH CHECK (is_active_superadmin(auth.uid()));

-- =============================================
-- reca_scales - Escalas de monotributo
-- =============================================
CREATE POLICY "superadmins_manage_reca_scales" ON public.reca_scales
  FOR ALL
  USING (is_active_superadmin(auth.uid()))
  WITH CHECK (is_active_superadmin(auth.uid()));

-- =============================================
-- reca_fee_components - Componentes de cuota
-- =============================================
CREATE POLICY "superadmins_manage_reca_fee_components" ON public.reca_fee_components
  FOR ALL
  USING (is_active_superadmin(auth.uid()))
  WITH CHECK (is_active_superadmin(auth.uid()));
