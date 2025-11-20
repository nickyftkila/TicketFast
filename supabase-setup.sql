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
  ('kei.martinez@duocuc.cl', 'Keila Martinez', 'user'),
  ('pruebacastom@gmail.com', 'Juan Cortez', 'support')
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

DELETE FROM users WHERE email IN ('kei.martinez@duocuc.cl', 'pruebacastom@gmail.com');

INSERT INTO users (id, email, full_name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Usuario'),
  CASE 
    WHEN au.email = 'pruebacastom@gmail.com' THEN 'support'
    ELSE 'user'
  END as role
FROM auth.users au
WHERE au.email IN ('kei.martinez@duocuc.cl', 'pruebacastom@gmail.com');



-- Actualizar referencias en tickets y respuestas a los IDs reales de auth
-- Esto actualiza los tickets/responses que fueron creados con IDs antiguos de users
-- a los nuevos IDs que vienen de auth.users

UPDATE tickets t
SET created_by = au.id
FROM auth.users au
WHERE EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = t.created_by 
  AND u.email = au.email
)
AND au.email IN ('kei.martinez@duocuc.cl', 'pruebacastom@gmail.com');



UPDATE ticket_responses tr
SET created_by = au.id
FROM auth.users au
WHERE EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = tr.created_by 
  AND u.email = au.email
)
AND au.email IN ('kei.martinez@duocuc.cl', 'pruebacastom@gmail.com');



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



-- 8) CREAR ÍNDICES PARA MEJORAR RENDIMIENTO

-- Índice para búsquedas por email (muy común)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Índice para búsquedas por created_by en tickets
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);

-- Índice para búsquedas por status en tickets
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- Índice para ordenar por created_at en tickets
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- Índice para búsquedas por ticket_id en ticket_responses
CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket_id ON ticket_responses(ticket_id);

-- Índice para búsquedas por created_by en ticket_responses
CREATE INDEX IF NOT EXISTS idx_ticket_responses_created_by ON ticket_responses(created_by);

-- Índice compuesto para búsquedas frecuentes de tickets por usuario y estado
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(created_by, status);


-- 9) FUNCIÓN Y TRIGGER PARA SINCRONIZAR USUARIOS AUTOMÁTICAMENTE
-- Cuando se crea un usuario en auth.users, se crea automáticamente en la tabla users

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    'user' -- Por defecto todos son 'user', los 'support' se asignan manualmente
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger para sincronizar usuarios automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- 10) INSERTAR UN TICKET DE PRUEBA SI NO HAY NINGUNO

INSERT INTO tickets (description, tags, is_urgent, created_by)
SELECT 
  'Ticket de prueba - Problema con WiFi',
  ARRAY['Sin WiFi', 'Consulta Técnica'],
  false,
  u.id
FROM users u 
WHERE u.email = 'kei.martinez@duocuc.cl'
AND NOT EXISTS (SELECT 1 FROM tickets LIMIT 1);



-- 11) VERIFICACIONES FINALES

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
