-- 0) PREVIO: EXTENSIONES REQUERIDAS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS pgcrypto;



-- 1) CREAR TABLAS (SI NO EXISTEN)

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'support')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



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



CREATE TABLE IF NOT EXISTS ticket_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  image_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  is_support_response BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



-- 2) FUNCIÓN Y TRIGGERS PARA updated_at

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;



DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS update_ticket_responses_updated_at ON ticket_responses;



CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_tickets_updated_at 
  BEFORE UPDATE ON tickets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_ticket_responses_updated_at 
  BEFORE UPDATE ON ticket_responses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- 3) DATOS BÁSICOS (USUARIOS)

INSERT INTO users (email, full_name, role) VALUES
  ('kei.martinez@duocuc.cl', 'Kei Martinez', 'user'),
  ('l.garciadelahu@duocuc.cl', 'L. Garcia de la Hu', 'support')
ON CONFLICT (email) DO NOTHING;



-- 4) STORAGE: CREAR BUCKET (SI NO EXISTE)

INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket-images', 'ticket-images', true)
ON CONFLICT (id) DO NOTHING;



-- 5) LIMPIEZA: DESHABILITAR RLS TEMPORALMENTE Y ELIMINAR POLÍTICAS EXISTENTES

ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_responses DISABLE ROW LEVEL SECURITY;
-- NOTA: No se puede deshabilitar RLS en storage.objects (tabla del sistema)
-- En su lugar, usaremos políticas de storage para controlar el acceso



DO $$
BEGIN
  -- Users
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own profile" ON users';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own profile" ON users';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all authenticated users to manage users" ON users';

  -- Tickets
  EXECUTE 'DROP POLICY IF EXISTS "Users can create tickets" ON tickets';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view all tickets" ON tickets';
  EXECUTE 'DROP POLICY IF EXISTS "Support can update tickets" ON tickets';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all authenticated users to manage tickets" ON tickets';

  -- Ticket Responses
  EXECUTE 'DROP POLICY IF EXISTS "Users can view ticket responses" ON ticket_responses';
  EXECUTE 'DROP POLICY IF EXISTS "Support can create responses" ON ticket_responses';
  EXECUTE 'DROP POLICY IF EXISTS "Support can update responses" ON ticket_responses';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON ticket_responses';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all authenticated users to manage responses" ON ticket_responses';

  -- Storage
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can upload images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all operations on storage" ON storage.objects';

EXCEPTION WHEN OTHERS THEN
  -- seguir aunque alguna no exista
  NULL;
END$$;



-- 6) SINCRONIZAR CON SUPABASE AUTH (SI EXISTE) Y ACTUALIZAR REFERENCIAS

-- Ajusta los correos si cambian en tu entorno

DELETE FROM users WHERE email IN ('kei.martinez@duocuc.cl', 'l.garciadelahu@duocuc.cl');

INSERT INTO users (id, email, full_name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Usuario'),
  CASE 
    WHEN au.email = 'l.garciadelahu@duocuc.cl' THEN 'support'
    ELSE 'user'
  END as role
FROM auth.users au
WHERE au.email IN ('kei.martinez@duocuc.cl', 'l.garciadelahu@duocuc.cl');



-- Actualizar referencias en tickets y respuestas a los IDs reales de auth

UPDATE tickets 
SET created_by = au.id
FROM auth.users au
WHERE tickets.created_by = (
  SELECT u.id FROM users u WHERE u.email = au.email
)
AND au.email IN ('kei.martinez@duocuc.cl', 'l.garciadelahu@duocuc.cl');



UPDATE ticket_responses 
SET created_by = au.id
FROM auth.users au
WHERE ticket_responses.created_by = (
  SELECT u.id FROM users u WHERE u.email = au.email
)
AND au.email IN ('kei.martinez@duocuc.cl', 'l.garciadelahu@duocuc.cl');



-- 7) CONFIGURAR RLS Y POLÍTICAS SIMPLIFICADAS

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;



-- CORREGIDO: Quitado IF NOT EXISTS (no es válido en CREATE POLICY)
CREATE POLICY "Allow all authenticated users to manage users" ON users
  FOR ALL USING (auth.role() = 'authenticated');



CREATE POLICY "Allow all authenticated users to manage tickets" ON tickets
  FOR ALL USING (auth.role() = 'authenticated');



CREATE POLICY "Allow all authenticated users to manage responses" ON ticket_responses
  FOR ALL USING (auth.role() = 'authenticated');



-- Storage: Políticas para permitir acceso a imágenes (RLS siempre está habilitado en storage.objects)
-- Eliminar políticas existentes de storage si las hay
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects';
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;

-- Crear políticas de storage para usuarios autenticados
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

CREATE POLICY "Users can update their own images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'ticket-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ticket-images' 
    AND auth.role() = 'authenticated'
  );



-- 8) INSERTAR UN TICKET DE PRUEBA SI NO HAY NINGUNO

INSERT INTO tickets (description, tags, is_urgent, created_by)
SELECT 
  'Ticket de prueba - Problema con WiFi',
  ARRAY['Sin WiFi', 'Consulta Técnica'],
  false,
  u.id
FROM users u 
WHERE u.email = 'kei.martinez@duocuc.cl'
AND NOT EXISTS (SELECT 1 FROM tickets LIMIT 1);



-- 9) VERIFICACIONES FINALES

SELECT 'Tablas listas' as status;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('users', 'tickets', 'ticket_responses')
ORDER BY tablename;



SELECT 'Políticas RLS (app)' as status;
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename IN ('users', 'tickets', 'ticket_responses')
ORDER BY tablename, policyname;



SELECT 'Bucket de storage' as status;
SELECT id, name, public FROM storage.buckets WHERE id = 'ticket-images';



SELECT 'SISTEMA LISTO' as status;
