# TicketFast - Sistema de Gestión de Tickets

Una aplicación moderna de gestión de tickets construida con Next.js, React y TypeScript.

⚠️ **NOTA**: Supabase ha sido eliminado del proyecto. El sistema de autenticación y base de datos necesita ser reemplazado.

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

## ⚠️ Estado Actual

**Supabase ha sido eliminado del proyecto**. Los siguientes componentes necesitan ser reemplazados:

- Sistema de autenticación
- Base de datos
- Almacenamiento de archivos
- Gestión de sesiones

## 🔧 Próximos Pasos

Para restaurar la funcionalidad completa, necesitarás:

1. **Implementar un nuevo sistema de autenticación** (ej: NextAuth.js, Auth0, etc.)
2. **Configurar una base de datos** (ej: PostgreSQL, MongoDB, etc.)
3. **Actualizar los hooks** (`useAuth`, `useTickets`)
4. **Reemplazar las llamadas a Supabase** en los componentes

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

El proyecto actualmente funciona en modo simulación:

- **Autenticación**: Formularios funcionales pero sin backend
- **Dashboard**: Interfaz completa pero sin persistencia de datos
- **Tickets**: Formulario funcional pero sin almacenamiento

Para probar el Dashboard, cambia `isAuthenticated` a `true` en `src/app/page.tsx`.

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
