# 🖥 Frontend — Pipeline de Datos y Componentes

## Stack

| Librería     | Versión  | Uso                           |
|--------------|----------|-------------------------------|
| jQuery       | 3.6.0    | DOM, eventos, AJAX            |
| Bootstrap    | 5.1.3    | Grid, componentes UI          |
| DataTables   | 1.13.7   | Tabla con búsqueda/paginación |
| Font Awesome | 6.0.0    | Iconografía                   |
| Montserrat   | Variable | Tipografía corporativa        |

Todas las librerías críticas tienen copia local en `css/`, `js/` y `vendor/` para funcionar sin internet en la red interna.

---

## Pipeline de Datos (JavaScript)

```
fetch("BackEnd/getReport.php")
        │
        ▼
   res.headers.get('X-Cache-Updated')
        │
        ▼
   Actualizar #lastUpdateLabel
        │
        ▼
   res.text()  →  SOAP XML string
        │
        ▼
   DOMParser.parseFromString(soap, "text/xml")
        │
        ▼
   getElementsByTagNameNS("*", "reportBytes")[0].textContent
        │
        ▼  base64ToXml()
   atob(base64)  →  Uint8Array  →  TextDecoder("utf-8")  →  XML string
        │
        ▼
   DOMParser.parseFromString(xml, "text/xml")
        │
        ▼
   getElementsByTagName("G_LOTE")  →  parseLotes()
        │
        ▼
   Array de objetos { org, item, desc, subinv, qty, um, lote, exp, locator }
        │
        ├──► renderStandardTable(data)   → DataTables
        └──► renderGearPage(data)        → Tarjetas paginadas
```

---

## Función `base64ToXml(base64)`

Decodifica el campo `reportBytes` de la respuesta Oracle:

```javascript
function base64ToXml(base64) {
    // Limpiar espacios y caracteres inválidos del base64
    const clean = base64.replace(/\s+/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const xmlText = new TextDecoder("utf-8").decode(bytes);
    return new DOMParser().parseFromString(xmlText, "text/xml");
}
```

> **¿Por qué limpiar el base64?** La respuesta SOAP puede incluir saltos de línea y espacios dentro del base64. `atob()` falla si recibe caracteres no válidos.

---

## Función `parseLotes(xml)`

Mapea nodos `G_LOTE` del XML a objetos JS:

```javascript
function parseLotes(xml) {
    const nodes = xml.getElementsByTagName("G_LOTE");
    return Array.from(nodes).map(n => ({
        org:     n.getElementsByTagName("ORGANIZATION_CODE")[0]?.textContent || "",
        item:    n.getElementsByTagName("ITEM_NUMBER")[0]?.textContent || "",
        desc:    n.getElementsByTagName("ITEM_DESC")[0]?.textContent || "",
        subinv:  n.getElementsByTagName("SUBINVENTORY_CODE")[0]?.textContent || "",
        qty:     n.getElementsByTagName("QTY_ONHAND")[0]?.textContent || "0",
        um:      "UN",
        lote:    n.getElementsByTagName("LOT_NUMBER")[0]?.textContent || "",
        exp:     n.getElementsByTagName("EXPIRATION_DATE")[0]?.textContent || "",
        locator: "—"
    }));
}
```

---

## Vista 1 — Tabla Estándar (DataTables)

Inicializada con:
```javascript
dataTable = $('#tablaExistencias').DataTable({
    language: { url: "//cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json" },
    dom: 'rtip',      // Solo tabla + info + paginación (sin searchbox nativo)
    pageLength: 10,
    responsive: true
});
```

Los filtros de Organización y Subinventario usan `dataTable.column(idx).search(val).draw()`.

La búsqueda inteligente (`#customSearch`) filtra sobre el array JS `gearData` y recarga la tabla con `renderStandardTable(filteredData)`.

---

## Vista 2 — Gear View (Tarjetas)

Paginación client-side con `gearPage` y `gearPageSize = 20`.

**Ciclo de render:**
1. `renderGearPage(data)` — genera HTML de tarjetas para la página actual
2. Inyecta paginador con botones `prevGear()` / `nextGear()`
3. `setTimeout(..., 50)` — después del render, resuelve imágenes asíncronamente via `getItemImage()`

**Imagen de artículo:**
```javascript
async function getItemImage(item) {
    const res = await fetch(`BackEnd/getItemImage.php?item=${encodeURIComponent(item)}`);
    const path = await res.text();
    return path.trim() || `https://placehold.co/180x180?text=${item}`;
}
```

Si `getItemImage.php` devuelve ruta vacía, se usa un placeholder de `placehold.co`.

---

## Componente de Última Actualización

En `load()`:
```javascript
const lastUpdated = res.headers.get('X-Cache-Updated');
if (lastUpdated) {
    const dt = new Date(lastUpdated); // ISO 8601 con offset → sin ambigüedad TZ
    document.getElementById('lastUpdateLabel').textContent =
        dt.toLocaleString('es-MX', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
}
```

HTML:
```html
<p class="text-muted small mt-1">
    <i class="fas fa-clock me-1"></i>
    Última actualización: <span id="lastUpdateLabel"><em>cargando...</em></span>
</p>
```

---

## Filtros y Búsqueda

| Control        | Elemento                  | Alcance                                                     |
|----------------|---------------------------|-------------------------------------------------------------|
| Organización   | `select[data-column="0"]` | DataTables column search                                    |
| Subinventario  | `select[data-column="4"]` | DataTables column search                                    |
| Búsqueda libre | `#customSearch`           | Filtra array JS en `org`, `item`, `desc`, `lote`, `locator` |

> **Nota:** Los filtros de select y el search libre operan sobre distintas capas (DataTables vs array JS). Si se combina búsqueda libre con filtros de select, el filtro de select sigue aplicado sobre DataTables pero `filteredData` solo refleja el texto del search libre.

---

## Imágenes de Artículos

Estructura de directorios:
```
assets/items/
└── {ITEM_CODE}/
    └── {ITEM_CODE}.jpg   (o .png, .jpeg, .bmp, .gif)
```

`getItemImage.php` recibe el código de artículo y busca el archivo. Si existe, devuelve la ruta relativa. El frontend actualiza el `src` del `<img>` con `id="img-{item}"`.

Para agregar imagen a un artículo nuevo:
1. Crear carpeta `assets/items/020-001-XXX/`
2. Colocar imagen como `assets/items/020-001-XXX/020-001-XXX.jpg`
