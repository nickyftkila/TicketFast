# TicketFast - Sistema de Gestión de Tickets

Una aplicación moderna de gestión de tickets construida con Next.js, React y TypeScript.

⚠️ **NOTA**: Este proyecto utiliza Supabase como backend para autenticación, base de datos y almacenamiento de archivos.

## 🚀 Características

- **Interfaz de autenticación** (sin backend)
- **Dashboard personalizado** con estadísticas
- **Diseño responsive** y moderno
- **Modo oscuro** incluido
- **Validación de formularios** con Zod
- **Gestión de estado** con React Hooks

## 🛠️ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Formularios**: React Hook Form + Zod
- **Iconos**: Lucide React

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn

## 🔧 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <tu-repositorio>
   cd TicketFast
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Ejecutar el proyecto**
   ```bash
   npm run dev
   ```

4. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## ⚙️ Configuración de Supabase

Este proyecto requiere una instancia de Supabase configurada. Para configurarlo:

1. **Crear un proyecto en Supabase** (https://supabase.com)
2. **Configurar las variables de entorno** creando un archivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
   ```
3. **Ejecutar el script de configuración** de la base de datos:
   ```bash
   # Ejecutar el contenido de supabase-setup.sql en tu proyecto de Supabase
   ```

## ⚠️ Estado Actual

El proyecto está completamente funcional con Supabase:

- ✅ Sistema de autenticación (login, registro, recuperación de contraseña)
- ✅ Base de datos (usuarios, tickets, respuestas)
- ✅ Almacenamiento de archivos (imágenes de tickets)
- ✅ Gestión de sesiones

## 📁 Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
├── components/             # Componentes React
│   ├── auth/              # Componentes de autenticación
│   ├── dashboard/         # Componentes del dashboard
│   └── ui/                # Componentes de UI reutilizables
├── hooks/                 # Custom hooks
├── lib/                   # Configuración y utilidades
└── types/                 # Tipos de TypeScript
```

## 🎨 Componentes Principales

- **AuthContainer**: Contenedor principal de autenticación
- **LoginForm**: Formulario de login
- **ForgotPasswordForm**: Recuperación de contraseña
- **Dashboard**: Panel principal después del login
- **useAuth**: Hook personalizado para autenticación

## 🔧 Configuración Actual

El proyecto está completamente funcional:

- **Autenticación**: Sistema completo con Supabase Auth
- **Dashboard**: Interfaz completa con persistencia de datos
- **Tickets**: Formulario funcional con almacenamiento en Supabase
- **Soporte**: Dashboard de soporte con gestión completa de tickets

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático

### Otros proveedores
- Netlify
- Railway
- DigitalOcean App Platform

## 📝 Notas Importantes

- **Estado actual**: Proyecto sin backend, solo frontend funcional
- **Autenticación**: Simulada, no hay persistencia real
- **Datos**: No se almacenan, solo se muestran en consola
- **Próximo paso**: Implementar un nuevo sistema de backend

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🆘 Soporte

Para soporte técnico, contacta al equipo de desarrollo.
