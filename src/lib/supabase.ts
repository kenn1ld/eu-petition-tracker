import { createClient } from '@supabase/supabase-js'

// Build-safe approach with fallbacks
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Helper to check if we have real credentials
export const hasValidSupabase = supabaseUrl !== 'https://placeholder.supabase.co'