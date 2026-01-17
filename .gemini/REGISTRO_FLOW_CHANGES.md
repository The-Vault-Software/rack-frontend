# Cambios en el Flujo de Registro

## Resumen

Se ha refactorizado completamente el flujo de registro de la aplicación para seguir un proceso de 3 pasos:

1. **Registro de Empresa** (Company)
2. **Registro de Usuario** (User)
3. **Configuración de Sucursal** (Branch Setup)

## Archivos Modificados y Creados

### 1. RegisterPage.tsx (Refactorizado)

**Ubicación:** `src/pages/auth/RegisterPage.tsx`

**Cambios principales:**

- Convertido en un wizard de 2 pasos con navegación visual
- **Paso 1:** Captura información de la empresa (nombre y email corporativo)
- **Paso 2:** Captura información del usuario (username, email personal, nombre, apellido, contraseña)
- Implementación de **Honeypot** simple para prevenir bots:
  - Campo oculto `website_url` que debe permanecer vacío
  - Validación con Zod: `z.string().max(0, "Bots no permitidos")`
  - Campo invisible con `opacity-0`, `z-index: -50`, y `pointer-events-none`
  - Incluye `tabIndex={-1}` y `autoComplete="off"` para evitar interacción accidental

**Flujo de registro automatizado:**

1. Registra el usuario en el backend (con company_id placeholder)
2. Inicia sesión automáticamente con las credenciales
3. Crea la empresa con los datos del paso 1
4. Invalida las queries de autenticación
5. Redirige a `/setup-branch` para completar la configuración

**Tecnologías utilizadas:**

- `motion/react` (framer-motion) para animaciones entre pasos
- Validación por pasos con `trigger()` de react-hook-form
- Indicador visual de progreso con pasos numerados

### 2. SetupBranchPage.tsx (Nuevo)

**Ubicación:** `src/pages/auth/SetupBranchPage.tsx`

**Propósito:** Página final del flujo de registro para crear la primera sucursal.

**Características:**

- Formulario para crear la primera sucursal (Branch)
- Campos: nombre (requerido), dirección, teléfono, email
- Iconos visuales para cada campo (Store, MapPin, Phone, Mail)
- Al completar, redirige a `/dashboard`
- Diseño consistente con el resto del flujo de registro

### 3. CreateCompanyPage.tsx (Sin cambios)

**Ubicación:** `src/pages/company/CreateCompanyPage.tsx`

**Nota:** Esta página se mantiene para casos donde un usuario autenticado sin empresa necesite crear una. El nuevo flujo de registro ya no la usa directamente, pero sigue disponible.

### 4. router.tsx (Actualizado)

**Ubicación:** `src/router.tsx`

**Cambios:**

- Agregada ruta `/setup-branch` dentro de `ProtectedLayout`
- Importado `SetupBranchPage`
- La ruta está al mismo nivel que `/create-company` (fuera de `DashboardLayout`)

```tsx
{
    path: '/setup-branch',
    element: <SetupBranchPage />
},
```

## Flujo Completo de Registro

### Antes

1. Usuario → `/register`
2. Crea cuenta de usuario
3. Redirige a `/create-company`
4. Crea empresa manualmente
5. Redirige a `/dashboard`

### Ahora

1. Usuario → `/register`
2. **Paso 1:** Ingresa datos de la empresa
3. **Paso 2:** Ingresa datos de usuario + validación honeypot
4. Sistema automáticamente:
   - Registra usuario
   - Inicia sesión
   - Crea empresa
5. Redirige a `/setup-branch`
6. Usuario crea primera sucursal
7. Redirige a `/dashboard`

## Seguridad: Honeypot Implementation

El honeypot es una técnica simple pero efectiva para prevenir bots:

```tsx
// Campo oculto en el formulario
<div className="absolute opacity-0 -z-50 pointer-events-none">
    <label htmlFor="website_url">Website</label>
    <input
        id="website_url"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        {...register('website_url')}
    />
</div>

// Validación en el schema
website_url: z.string().max(0, "Bots no permitidos").optional(),

// Verificación en el submit
if (data.website_url && data.website_url.length > 0) return; // Silent fail
```

**Ventajas:**

- No requiere servicios externos (como reCAPTCHA)
- Invisible para usuarios humanos
- Efectivo contra bots básicos
- Sin impacto en UX

**Limitaciones:**

- No protege contra bots sofisticados
- Para mayor seguridad, considerar agregar reCAPTCHA v3 o similar

## Dependencias Agregadas

```json
{
  "framer-motion": "^latest" // Para animaciones en el wizard
}
```

**Nota:** El proyecto ya usa `motion` (v12.26.2), que es la versión moderna de framer-motion. Las importaciones usan `motion/react`.

## Mejoras Futuras Sugeridas

1. **Validación de email corporativo:** Verificar que el email de la empresa sea diferente al personal
2. **Confirmación de contraseña:** Agregar campo de confirmación en el paso 2
3. **Indicador de fortaleza de contraseña:** Feedback visual en tiempo real
4. **CAPTCHA avanzado:** Considerar reCAPTCHA v3 para mayor seguridad
5. **Verificación de email:** Enviar email de confirmación post-registro
6. **Manejo de errores granular:** Distinguir entre errores de registro, login, y creación de empresa
7. **Persistencia de datos:** Guardar progreso en localStorage para recuperar si el usuario cierra la página

## Testing Recomendado

1. **Flujo completo:** Registrar una nueva empresa desde cero
2. **Validaciones:** Probar cada campo con datos inválidos
3. **Honeypot:** Verificar que bots que llenen el campo oculto sean rechazados
4. **Navegación:** Probar botones "Atrás" y "Siguiente"
5. **Errores de red:** Simular fallos en cada paso del proceso
6. **Responsive:** Verificar en móvil y tablet
7. **Animaciones:** Confirmar transiciones suaves entre pasos

## Notas Técnicas

- El `company_id` placeholder (`00000000-0000-0000-0000-000000000000`) se usa temporalmente durante el registro del usuario
- El backend debe manejar este caso especial y permitir la creación del usuario sin empresa válida
- La autenticación se invalida correctamente después de cada paso crítico
- Las mutaciones se ejecutan secuencialmente con `async/await` para garantizar el orden correcto
