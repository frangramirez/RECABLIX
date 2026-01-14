import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Cargar variables de entorno
config()

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestUser() {
  console.log('🔧 Creating test user...')

  // Crear usuario con Admin API
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: 'test@recablix.ar',
    password: 'testing123',
    email_confirm: true,
    user_metadata: {
      name: 'Usuario Testing'
    }
  })

  if (userError) {
    console.error('❌ Error creating user:', userError.message)
    process.exit(1)
  }

  console.log('✅ User created:', user.user.id)

  // Asociar al studio de testing
  const { error: memberError } = await supabase
    .from('studio_members')
    .insert({
      studio_id: '844d1357-35f9-4496-825c-6a31558ef974',
      user_id: user.user.id,
      role: 'owner'
    })

  if (memberError) {
    console.error('❌ Error adding to studio:', memberError.message)
    process.exit(1)
  }

  console.log('✅ User added to studio')
  console.log('\n📝 Credentials:')
  console.log('   Email: test@recablix.ar')
  console.log('   Password: testing123')
}

createTestUser().catch(console.error)
