# Guía de Pruebas - TicketFast

Este documento describe la estrategia de pruebas para el sistema TicketFast.

## 📋 Resumen de Pruebas

### Funcionalidades Cubiertas

#### 1. Autenticación (`useAuth`)
- ✅ Login con credenciales válidas
- ✅ Login con credenciales inválidas
- ✅ Manejo de errores de conexión
- ✅ Registro de nuevos usuarios
- ✅ Validación de email duplicado
- ✅ Recuperación de contraseña
- ✅ Actualización de contraseña
- ✅ Logout
- ✅ Carga de perfil de usuario

#### 2. Cálculo de Prioridades Automáticas
- ✅ Prioridad Alta (score >= 70)
  - Tags críticos + keywords importantes
  - Múltiples tags críticos
  - Keywords como "wifi caído"
- ✅ Prioridad Media (score 40-69)
  - Tags como "Impresora"
  - Keywords como "no proyecta"
- ✅ Prioridad Baja (score < 40)
  - Tickets sin tags críticos
  - Descripciones simples
- ✅ Reglas Combinadas
  - "recepción" + "no funciona"
  - "cocina" + "sin luz"
- ✅ Tags con Peso
  - Todos los tags críticos reconocidos
- ✅ Keywords Generales
  - "no funciona", "caído", "urgente"
- ✅ Casos Edge
  - Descripción vacía
  - Tags vacíos
  - Múltiples tags
  - Flag is_urgent

#### 3. Componentes de Autenticación (`LoginForm`)
- ✅ Renderizado del formulario
- ✅ Validación de email inválido
- ✅ Validación de contraseña corta
- ✅ Envío exitoso de credenciales
- ✅ Manejo de errores de login
- ✅ Mostrar/ocultar contraseña
- ✅ Navegación a recuperación de contraseña
- ✅ Estado de carga durante envío

#### 4. Pruebas de Seguridad (`security.test.ts`)
- ✅ Autenticación y Autorización
  - Rechazo de login sin credenciales
  - Validación de emails y contraseñas
  - Expiración de sesiones
  - Control de acceso basado en roles
  - Aislamiento de datos por usuario
- ✅ Validación de Entrada
  - Protección contra inyección SQL
  - Validación de tags
  - Validación de emails
  - Validación de contraseñas
  - Límites de longitud de campos
- ✅ Protección de Datos
  - No exposición de contraseñas
  - Protección de tokens de sesión
  - Protección contra XSS
  - Validación de URLs
- ✅ Rate Limiting y Protección
  - Protección contra fuerza bruta
  - Validación de CORS
- ✅ Validación de Archivos
  - Tipos de archivo permitidos
  - Límites de tamaño
  - Nombres de archivo seguros
- ✅ Políticas RLS
  - Validación de RLS habilitado
  - Protección contra modificación de datos de otros usuarios

## 🧪 Ejecutar Pruebas

### Ejecutar todas las pruebas
```bash
npm test
```

### Ejecutar pruebas en modo watch
```bash
npm run test:watch
```

### Ejecutar pruebas con cobertura
```bash
npm run test:coverage
```

## 📁 Estructura de Pruebas

```
src/
├── hooks/
│   └── __tests__/
│       ├── useAuth.test.tsx
│       └── useTickets.priority.test.ts
├── components/
│   └── auth/
│       └── __tests__/
│           └── LoginForm.test.tsx
└── __tests__/
    └── security.test.ts
```

## 🎯 Cobertura de Pruebas

### 📊 Cobertura Actual: 12.37%

**Estado**: ⚠️ Cobertura insuficiente para producción (recomendado: 70%+)

### Funcionalidades Principales

#### Autenticación (70.83% cobertura en useAuth)
- [x] Login
- [x] Registro
- [x] Recuperación de contraseña
- [x] Actualización de contraseña
- [x] Logout
- [x] Gestión de sesión
- [ ] Componentes: AuthContainer, ForgotPasswordForm, RegisterForm, ProtectedRoute

#### Seguridad (26 pruebas completas)
- [x] Autenticación y autorización
- [x] Validación de entrada
- [x] Protección contra inyección SQL
- [x] Protección contra XSS
- [x] Validación de archivos
- [x] Protección de datos sensibles
- [x] Rate limiting
- [x] Políticas RLS

#### Gestión de Tickets (0% cobertura en useTickets)
- [x] Cálculo de prioridades automáticas (31 pruebas)
- [ ] **CRÍTICO**: Crear ticket
- [ ] **CRÍTICO**: Listar tickets
- [ ] **CRÍTICO**: Subir imágenes
- [ ] **CRÍTICO**: Obtener respuestas de ticket
- [ ] Filtrar tickets por estado
- [ ] Ver detalles de ticket
- [ ] Responder a ticket
- [ ] Cambiar estado de ticket

#### Dashboard (0% cobertura)
- [ ] **CRÍTICO**: Dashboard de usuario (crear tickets, listar, filtrar)
- [ ] **CRÍTICO**: Dashboard de soporte (cambiar estado, responder)
- [ ] Filtros y búsqueda
- [ ] Estadísticas y métricas
- [ ] Responsive design (drawers móviles)

#### UI/UX (20% cobertura)
- [x] Formulario de login (90.9% cobertura)
- [ ] Formulario de registro
- [ ] Formulario de recuperación
- [ ] Sistema de Toast/notificaciones
- [ ] Responsive design (useMediaQuery)
- [ ] Tema oscuro

## 🔒 Pruebas de Seguridad

### Funcionalidades Cubiertas

#### 1. Autenticación
- ✅ Rechazo de credenciales vacías
- ✅ Validación de formato de email
- ✅ Validación de longitud mínima de contraseña
- ✅ Rechazo de contraseñas incorrectas
- ✅ Validación de expiración de sesiones

#### 2. Autorización y Roles
- ✅ Verificación de autenticación para crear tickets
- ✅ Control de acceso al dashboard de soporte
- ✅ Usuarios solo ven sus propios tickets
- ✅ Solo support puede cambiar estado de tickets
- ✅ Solo support puede responder a tickets

#### 3. Validación de Entrada y Sanitización
- ✅ Prevención de XSS en descripciones
- ✅ Validación de longitud máxima
- ✅ Rechazo de tags peligrosos
- ✅ Validación de URLs de imágenes
- ✅ Validación de tipos de archivo
- ✅ Validación de tamaño de archivos

#### 4. Protección de Datos Sensibles
- ✅ Contraseñas no expuestas en respuestas
- ✅ Enmascaramiento de datos sensibles en logs
- ✅ Validación de tokens en URLs

#### 5. Protección contra Ataques Comunes
- ✅ Prevención de inyección SQL
- ✅ Prevención de path traversal
- ✅ Rate limiting en login
- ✅ Protección CSRF

#### 6. Validación de Permisos CRUD
- ✅ Permisos para crear tickets
- ✅ Permisos para leer tickets
- ✅ Permisos para actualizar tickets
- ✅ Permisos para eliminar tickets

#### 7. Validación de Headers y CORS
- ✅ Validación de Content-Type
- ✅ Validación de origen (CORS)

#### 8. Validación de Integridad de Datos
- ✅ Validación de UUIDs
- ✅ Validación de timestamps

## ⚠️ Análisis de Cobertura

### Estado Actual
- **Cobertura Total**: 12.37% (Statements)
- **Meta Recomendada**: 70-80% para producción
- **Estado**: ⚠️ **INSUFICIENTE** - Se requiere trabajo adicional

### Lo que Falta (87.63% del código)

#### 🔴 CRÍTICO - Funcionalidad Core (0% cobertura)
1. **useTickets Hook completo**
   - Crear, listar, actualizar tickets
   - Subir imágenes
   - Obtener y crear respuestas
   
2. **Dashboard de Usuario**
   - Formulario de creación de tickets
   - Lista y filtrado
   - Visualización de detalles
   
3. **Dashboard de Soporte**
   - Cambio de estado de tickets
   - Respuestas a tickets
   - Métricas y estadísticas

#### 🟡 IMPORTANTE - Componentes Restantes
4. **Componentes de Autenticación**
   - ForgotPasswordForm
   - RegisterForm
   - AuthContainer
   - ProtectedRoute

5. **Hooks Adicionales**
   - useMediaQuery (responsive)

6. **Componentes UI**
   - Toast (sistema de notificaciones)

#### 🟢 BAJA PRIORIDAD
7. **Páginas**
   - page.tsx (ruteo básico)
   - reset-password/page.tsx

Ver análisis detallado en `COVERAGE_ANALYSIS.md`

## 🔄 Próximas Pruebas a Implementar

### Pruebas de Seguridad Implementadas ✅
1. **Autenticación y Autorización**
   - Validación de credenciales
   - Expiración de sesiones
   - Control de acceso basado en roles
   - Aislamiento de datos por usuario

2. **Validación de Entrada**
   - Protección contra inyección SQL
   - Validación de emails
   - Validación de contraseñas
   - Límites de longitud de campos

3. **Protección de Datos**
   - No exposición de contraseñas
   - Sanitización de contenido HTML
   - Validación de URLs
   - Protección contra XSS

4. **Validación de Archivos**
   - Tipos de archivo permitidos
   - Límites de tamaño
   - Nombres de archivo seguros

5. **Políticas de Seguridad**
   - Row Level Security (RLS)
   - Rate limiting
   - Validación CORS

### Prioridad Alta
1. **Pruebas de integración para useTickets**
   - Crear ticket
   - Subir imagen
   - Obtener respuestas de ticket

2. **Pruebas para Dashboard de Usuario**
   - Crear ticket desde el formulario
   - Filtrar tickets por estado
   - Ver detalles de ticket
   - Ver historial de conversación

3. **Pruebas para Dashboard de Soporte**
   - Cambiar estado de ticket
   - Responder a ticket
   - Ver métricas
   - Filtrar tickets

### Prioridad Media
4. **Pruebas E2E con Playwright**
   - Flujo completo de creación de ticket
   - Flujo completo de respuesta a ticket
   - Flujo de autenticación completo

5. **Pruebas de accesibilidad**
   - Navegación por teclado
   - Lectores de pantalla
   - Contraste de colores

6. **Pruebas de rendimiento**
   - Carga de listas grandes de tickets
   - Optimización de imágenes
   - Lazy loading

## 📝 Notas de Testing

### Mocks y Stubs
- Supabase está mockeado en todas las pruebas
- Next.js router está mockeado
- window.matchMedia está mockeado para pruebas responsive

### Configuración
- Jest configurado con `next/jest`
- React Testing Library para pruebas de componentes
- jsdom como entorno de pruebas

### Buenas Prácticas
- Cada prueba es independiente
- Mocks se limpian entre pruebas
- Se usa `waitFor` para operaciones asíncronas
- Se valida tanto casos exitosos como errores

## 🐛 Reportar Problemas

Si encuentras problemas con las pruebas:
1. Verifica que todas las dependencias estén instaladas
2. Ejecuta `npm test` para ver errores específicos
3. Revisa la configuración de Jest en `jest.config.js`
4. Asegúrate de que los mocks estén correctamente configurados

