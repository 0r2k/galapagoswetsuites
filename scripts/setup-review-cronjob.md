# Configuración del Cronjob para Sistema de Reseñas

Este documento explica cómo configurar el sistema automatizado de solicitud de reseñas.

## Opciones de Implementación

### Opción 1: Cron Job del Sistema (Recomendado para VPS/Servidor Dedicado)

Si tu aplicación está desplegada en un VPS o servidor dedicado, puedes usar cron:

```bash
# Editar crontab
crontab -e

# Agregar esta línea para ejecutar diariamente a las 9:00 AM
0 9 * * * curl -X POST https://tu-dominio.com/api/reviews/cronjob -H "Content-Type: application/json"
```

### Opción 2: Vercel Cron Jobs (Para despliegues en Vercel)

Si usas Vercel, crea un archivo `vercel.json` en la raíz del proyecto:

```json
{
  "crons": [
    {
      "path": "/api/reviews/cronjob",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Opción 3: GitHub Actions (Gratuito)

Crea `.github/workflows/review-cronjob.yml`:

```yaml
name: Review Request Cronjob
on:
  schedule:
    - cron: '0 9 * * *' # Diariamente a las 9:00 AM UTC
  workflow_dispatch: # Permite ejecución manual

jobs:
  send-review-requests:
    runs-on: ubuntu-latest
    steps:
      - name: Send Review Requests
        run: |
          curl -X POST https://tu-dominio.com/api/reviews/cronjob \
            -H "Content-Type: application/json"
```

### Opción 4: Servicios de Terceros

#### EasyCron (Gratuito hasta 20 trabajos)
1. Registrarse en https://www.easycron.com/
2. Crear nuevo cron job
3. URL: `https://tu-dominio.com/api/reviews/cronjob`
4. Método: POST
5. Programación: `0 9 * * *`

#### Cron-job.org (Gratuito)
1. Registrarse en https://cron-job.org/
2. Crear nuevo cron job
3. URL: `https://tu-dominio.com/api/reviews/cronjob`
4. Programación: Diario a las 9:00 AM

## Configuración de Variables de Entorno

Asegúrate de tener estas variables configuradas:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
```

## Pruebas

### Prueba Manual
```bash
# Obtener pedidos elegibles (sin enviar emails)
curl https://tu-dominio.com/api/reviews/cronjob

# Enviar emails de reseña
curl -X POST https://tu-dominio.com/api/reviews/cronjob
```

### Verificar en Base de Datos
```sql
-- Ver pedidos que han recibido email de reseña
SELECT 
  id, 
  order_number, 
  end_date, 
  review_email_sent, 
  review_email_sent_at
FROM rental_orders 
WHERE review_email_sent = true;
```

## Monitoreo

El endpoint devuelve información útil para monitoreo:

```json
{
  "success": true,
  "message": "Emails de reseña enviados exitosamente",
  "processed": 5,
  "sent": 4,
  "failed": 1,
  "details": [...]
}
```

## Consideraciones de Seguridad

1. **Autenticación**: Considera agregar un token de autenticación al endpoint
2. **Rate Limiting**: Implementa límites de velocidad para evitar abuso
3. **Logs**: Mantén logs de las ejecuciones para debugging

## Ejemplo de Implementación con Autenticación

```typescript
// En /api/reviews/cronjob/route.ts
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRONJOB_SECRET_TOKEN
  
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  
  // ... resto del código
}
```

Y en el cron job:
```bash
curl -X POST https://tu-dominio.com/api/reviews/cronjob \
  -H "Authorization: Bearer tu_token_secreto" \
  -H "Content-Type: application/json"
```