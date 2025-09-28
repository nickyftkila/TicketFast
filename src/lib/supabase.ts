import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ktbnambciqauyssrneyl.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Ym5hbWJjaXFhdXlzc3JuZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODUyOTgsImV4cCI6MjA3NDI2MTI5OH0.B7osCpOpMtZSSzLZTMqnVyuHd__fGzXuZlJjZzYONiU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos para TypeScript
export interface User {
  id: string
  email: string
  full_name: string
  role: 'user' | 'support'
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  description: string
  tags: string[]
  is_urgent: boolean
  image_url: string | null
  status: 'pending' | 'in_progress' | 'resolved'
  created_by: string
  created_at: string
  updated_at: string
}
