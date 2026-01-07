# 🏗 Arquitectura del Sistema

## Visión General

El portal es una aplicación PHP sin framework con una Single Page (SPA-like) en `index.html`. No existe routing del lado del servidor; toda la lógica de presentación y transformación de datos ocurre en el navegador via JavaScript.

---

## Capas del Sistema

```
┌────────────────────────────────────────────────────┐
│  CAPA DE PRESENTACIÓN (Browser)                    │
│  index.html + AlmexStyle.css                       │
│  jQuery · Bootstrap 5 · DataTables · Font Awesome  │
└────────────────────┬───────────────────────────────┘
                     │  fetch() / XMLHttpRequest
┌────────────────────▼───────────────────────────────┐
│  CAPA DE BACKEND (PHP — Apache)                    │
│  BackEnd/getReport.php     ← CORE                  │
│  BackEnd/getItemImage.php  ← Imágenes              │
└────────────────────┬───────────────────────────────┘
                     │  File I/O (caché)
┌────────────────────▼───────────────────────────────┐
│  PERSISTENCIA LOCAL                                │
│  BackEnd/cache/report_cache.xml   (TTL 10 min)    │
│  assets/items/{ITEM_CODE}/        (imágenes)       │
└────────────────────┬───────────────────────────────┘
                     │  HTTPS + SOAP/XML
┌────────────────────▼───────────────────────────────┐
│  ORACLE FUSION CLOUD                               │
│  BI Publisher — ExternalReportWSSService           │
│  Reporte: XXALM_LOTE_ONHAND_REP.xdo               │
└────────────────────────────────────────────────────┘
```

---

## Componentes Principales

### `index.html`
Punto de entrada único. Contiene el HTML, CSS inline mínimo y todo el JavaScript de la aplicación. No hay bundler ni transpilación; el código es ES2017+ nativo.

**Responsabilidades:**
- Inicializar DataTables
- Llamar a `BackEnd/getReport.php` al cargar
- Parsear la respuesta SOAP/XML/Base64
- Renderizar las dos vistas (tabla y tarjetas)
- Mostrar la hora de última actualización del caché

### `BackEnd/getReport.php`
Único punto de integración con Oracle. Implementa:
- Caché de archivo con TTL de 10 minutos
- Llamada SOAP con autenticación Basic sobre HTTPS
- Headers de respuesta con metadata del caché
- Fallback a caché vencida ante fallo de red

### `BackEnd/getItemImage.php`
Resuelve la imagen de un artículo a partir de su código. Busca en `assets/items/{ITEM_CODE}/` con soporte para `.jpg`, `.jpeg`, `.png`, `.bmp`, `.gif`. Devuelve la ruta relativa o cadena vacía.

### `BackEnd/cache/`
Directorio protegido con `.htaccess` (`Deny from all`). Contiene únicamente el XML cacheado del reporte. Está excluido de git via `.gitignore`.

---

## Decisiones de Diseño

| Decisión           | Alternativa Descartada | Razón                                              |
|--------------------|------------------------|----------------------------------------------------|
| Caché en archivo   | Redis / Memcached      | Sin dependencias adicionales en el servidor        |
| Caché en archivo   | Caché en base de datos | Reporte es un blob XML ~2 MB, no relacional        |
| SPA en HTML puro   | Framework React/Vue    | Proyecto interno, cero build tooling necesario     |
| Librerías locales  | Solo CDN               | Funcionamiento sin internet en red interna         |
| Self-hosted runner | GitHub-hosted runner   | Despliegue directo al servidor sin exponer puertos |
| SOAP sobre REST    | REST API de Oracle     | El endpoint OTBI disponible es SOAP/WSDL           |

---

## Esquema de Datos — Nodo `G_LOTE`

Cada registro del reporte Oracle mapea a un objeto JavaScript con esta estructura:

```json
{
  "org":    "ALM1",           // ORGANIZATION_CODE
  "item":   "020-001-005",    // ITEM_NUMBER
  "desc":   "Motor 5HP",      // ITEM_DESC
  "subinv": "PT",             // SUBINVENTORY_CODE
  "qty":    "24.00",          // QTY_ONHAND
  "um":     "UN",             // (fijo por ahora)
  "lote":   "L-9982-24",      // LOT_NUMBER
  "exp":    "2028-05-20",     // EXPIRATION_DATE
  "locator": "—"              // (pendiente de integrar)
}
```

---

## Consideraciones de Seguridad

- `BackEnd/cache/.htaccess` bloquea acceso directo al XML del reporte
- `cacert.pem` fuerza verificación SSL contra Oracle Cloud
- Las credenciales Basic Auth están en Base64 dentro del PHP — considerar externalizar a variables de entorno del servidor Apache (`SetEnv`) o un archivo fuera del webroot
- El directorio `BackEnd/` no tiene `index.php`; dependiendo de la configuración Apache puede listar su contenido — añadir `.htaccess` con `Options -Indexes`
