import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lswsqruldbzccoaicamg.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_gHlTdVrxyRMn74CPOT7OrQ_8O4O1O1D'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)