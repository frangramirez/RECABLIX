import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase'

export const GET: APIRoute = async ({ cookies, request }) => {
  try {
    const results: Record<string, unknown> = {}

    // 1. Check cookies received
    const cookieHeader = request.headers.get('cookie')
    results.cookieHeaderPresent = !!cookieHeader
    results.cookieNames = cookieHeader?.split(';').map(c => c.trim().split('=')[0]) || []

    // 2. Create supabase client and check user
    const supabase = createSupabaseServerClient(cookies, request)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    results.user = userData?.user ? { id: userData.user.id, email: userData.user.email } : null
    results.userError = userError?.message || null

    if (userData?.user) {
      // 3. Check superadmin with normal client
      const { data: superadmin, error: superadminError } = await supabase
        .from('superadmins')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .single()
      results.superadminWithRLS = superadmin
      results.superadminErrorWithRLS = superadminError?.message || null

      // 4. Check superadmin with admin client (bypass RLS)
      if (supabaseAdmin) {
        const { data: superadminAdmin, error: superadminAdminError } = await supabaseAdmin
          .from('superadmins')
          .select('*')
          .eq('user_id', userData.user.id)
          .eq('is_active', true)
          .single()
        results.superadminBypassRLS = superadminAdmin
        results.superadminErrorBypassRLS = superadminAdminError?.message || null
      }

      // 5. Check studio_members with normal client
      const { data: membership, error: membershipError } = await supabase
        .from('studio_members')
        .select('studio_id, role, studios(*)')
        .eq('user_id', userData.user.id)
        .single()
      results.membershipWithRLS = membership
      results.membershipErrorWithRLS = membershipError?.message || null

      // 6. Check studio_members with admin client (bypass RLS)
      if (supabaseAdmin) {
        const { data: membershipAdmin, error: membershipAdminError } = await supabaseAdmin
          .from('studio_members')
          .select('studio_id, role, studios(*)')
          .eq('user_id', userData.user.id)
          .limit(1)
        results.membershipBypassRLS = membershipAdmin?.[0]
        results.membershipErrorBypassRLS = membershipAdminError?.message || null
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
