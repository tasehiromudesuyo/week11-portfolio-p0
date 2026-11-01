import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lswsqruldbzccoaicamg.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_secret_h1dx1m0vgOzk1Cc6Y2JEMA_cbC0tidb'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)