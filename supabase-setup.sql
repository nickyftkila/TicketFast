-- =============================================
-- SCRIPT DE CONFIGURACIÓN DE SUPABASE
-- TicketFast - Sistema de Gestión de Tickets
-- =============================================

-- 1. Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'support')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla de tickets
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_urgent BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insertar usuarios iniciales
INSERT INTO users (email, full_name, role) VALUES
  ('kei.martinez@duocuc.cl', 'Kei Martinez', 'user'),
  ('l.garciadelahu@duocuc.cl', 'L. Garcia de la Hu', 'support')
ON CONFLICT (email) DO NOTHING;

-- 4. Crear función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Crear triggers para updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at 
  BEFORE UPDATE ON tickets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Habilitar Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de seguridad para usuarios
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.email() = email);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.email() = email);

-- 8. Políticas de seguridad para tickets
CREATE POLICY "Users can create tickets" ON tickets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view all tickets" ON tickets
  FOR SELECT USING (true);

CREATE POLICY "Support can update tickets" ON tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'support'
    )
  );

-- =============================================
-- SCRIPT PARA CORREGIR POLÍTICAS DE ALMACENAMIENTO
-- TicketFast - Sistema de Gestión de Tickets
-- =============================================

-- 1. Crear el bucket para imágenes de tickets / manualmente en supabase
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket-images', 'ticket-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Eliminar políticas existentes si las hay (para evitar conflictos)
DROP POLICY IF EXISTS "Anyone can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view images" ON storage.objects;

-- 3. Crear políticas de almacenamiento para usuarios autenticados
CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ticket-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can view images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ticket-images' 
    AND auth.role() = 'authenticated'
  );

-- 4. Política adicional para permitir que los usuarios puedan actualizar sus propias imágenes
CREATE POLICY "Users can update their own images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'ticket-images' 
    AND auth.role() = 'authenticated'
  );

-- 5. Política para permitir eliminación de imágenes (opcional)
CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ticket-images' 
    AND auth.role() = 'authenticated'
  );

