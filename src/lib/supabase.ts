import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validar que las credenciales estén configuradas
// Solo validar en el cliente, no en el servidor durante SSR
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  const errorMsg = '⚠️ Error: Las credenciales de Supabase no están configuradas. Por favor, configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local'
  console.error(errorMsg)
}

// Singleton pattern para evitar múltiples instancias del cliente
let supabaseInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    // TypeScript ahora sabe que estas variables son strings por la validación anterior
    // Configuración optimizada para Next.js 15 y Supabase-js v2
    supabaseInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ticketfast-auth', // Clave única para evitar conflictos
        // Para Next.js 15, asegurar que el storage funcione correctamente
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        flowType: 'pkce' // Usar PKCE para mejor seguridad
      },
      // Configuración global para Next.js 15
      db: {
        schema: 'public'
      }
      // NOTA: No especificar headers globales aquí porque supabase-js v2
      // los maneja automáticamente según el método (GET para select, POST para insert)
      // Especificar headers manualmente puede causar conflictos con el método HTTP
    })
  }
  return supabaseInstance
}

export const supabase = getSupabaseClient()

// Tipos para TypeScript
export interface User {
  id: string
  email: string
  full_name: string
  role: 'user' | 'support' | 'supervisor'
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
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface TicketResponse {
  id: string
  ticket_id: string
  message: string
  image_url: string | null
  created_by: string
  is_support_response: boolean
  created_at: string
  updated_at: string
}
