# 💾 Estrategia de Caché

## Resumen

El caché está implementado a nivel de archivo PHP, sin dependencias externas. Almacena la respuesta SOAP completa de Oracle en `BackEnd/cache/report_cache.xml` con un TTL de 10 minutos.

---

## Diagrama de Flujo

```
Request → getReport.php
               │
               ▼
    ┌─ file_exists(cache)? ─┐
    │                       │
   NO                      SI
    │                       │
    │          ┌── age < 600s? ──┐
    │          │                 │
    │         SI                NO
    │          │                 │
    │    readfile(cache)    [llamar Oracle]
    │    X-Cache-Hit: true       │
    │          │            ¿curl ok?
    │          │           /        \
    │          │          SI        NO
    │          │          │          │
    │    [escribir cache] │    [cache existe?]
    │    echo $response   │     /         \
    │    Hit: false       │    SI         NO
    │                     │    │           │
    │              readfile(cache)    HTTP 503
    │              Hit: stale
    └──────────────────────────────────────┘
                   │
              Response al Browser
```

---

## Headers de Respuesta

Cada respuesta de `getReport.php` incluye estos headers:

| Header            | Valores posibles    | Descripción                                          |
|-------------------|---------------------|------------------------------------------------------|
| `X-Cache-Hit`     | `true`              | Sirvió desde caché válida                            |
| `X-Cache-Hit`     | `false`             | Llamó a Oracle y actualizó caché                     |
| `X-Cache-Hit`     | `stale`             | Oracle falló, sirvió caché vencida                   |
| `X-Cache-Updated` | ISO 8601 con offset | Timestamp del dato (ej. `2026-04-07T12:30:00-06:00`) |

### Por qué ISO 8601 con offset de zona horaria

El header se genera con `date('c')` en PHP, que produce el formato `Y-m-d\TH:i:sO` (ej. `2026-04-07T12:30:00-06:00`).

Usar este formato evita el bug clásico de desfase de horas: si se envía `"2026-04-07 12:30:00"` sin zona horaria, `new Date()` en JavaScript puede interpretarlo como UTC, restando 6 horas a usuarios en UTC-6 (México).

Con el offset explícito:
```javascript
const dt = new Date(lastUpdated); // "2026-04-07T12:30:00-06:00"
dt.toLocaleString('es-MX');       // → "07/04/2026, 12:30" ✓
```

---

## Configuración

```php
$cacheFile = __DIR__ . '/cache/report_cache.xml';
$cacheTTL  = 10 * 60; // 600 segundos
```

Para cambiar el TTL, modificar el valor `10` (minutos) en `getReport.php`.

---

## Protección del Directorio

`BackEnd/cache/.htaccess`:
```apache
Deny from all
```

Esto impide que alguien acceda a `http://servidor/BackEnd/cache/report_cache.xml` directamente desde el navegador, ya que el XML contiene datos de inventario sensibles.

---

## Invalidación Manual del Caché

Para forzar una actualización inmediata sin esperar los 10 minutos:

```bash
# Desde el servidor
rm /var/www/rptOnHandWeb_main/BackEnd/cache/report_cache.xml
```

El siguiente request a `getReport.php` obtendrá datos frescos de Oracle y regenerará el archivo.

---

## Comportamiento en Fallo de Oracle

Si el servicio Oracle no responde (timeout, error de red):

1. **Si existe caché** (aunque esté vencida): se sirve con `X-Cache-Hit: stale`
2. **Si no existe caché**: responde HTTP 503 con el mensaje de error de cURL

Esto garantiza que el portal siga funcionando durante mantenimientos o interrupciones temporales de Oracle Fusion, sirviendo los últimos datos conocidos.

---

## Zona Horaria del Servidor

El timestamp del caché usa la zona horaria configurada en PHP. Si el servidor está en UTC y los usuarios están en UTC-6 (México), agregar al inicio de `getReport.php`:

```php
date_default_timezone_set('America/Mexico_City');
```

O configurar en `php.ini`:
```ini
date.timezone = America/Mexico_City
```
