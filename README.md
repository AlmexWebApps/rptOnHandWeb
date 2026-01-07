# 📦 Portal de Inventarios On-Hand — ALMEX

![PHP](https://img.shields.io/badge/PHP-8.x-777BB4?style=flat-square&logo=php&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.1.3-7952B3?style=flat-square&logo=bootstrap&logoColor=white)
![jQuery](https://img.shields.io/badge/jQuery-3.6.0-0769AD?style=flat-square&logo=jquery&logoColor=white)
![DataTables](https://img.shields.io/badge/DataTables-1.13.7-green?style=flat-square)
![Oracle](https://img.shields.io/badge/Oracle-BI_Publisher-F80000?style=flat-square&logo=oracle&logoColor=white)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Self--Hosted_Runner-181717?style=flat-square&logo=github&logoColor=white)
![License](https://img.shields.io/badge/Uso-Interno_ALMEX-red?style=flat-square)

Portal web interno para consulta en tiempo real de existencias de inventario (On-Hand) obtenidas desde **Oracle Fusion Cloud** vía SOAP, con caché de archivo, dos modos de vista y despliegue automatizado por CI/CD.

---

## 📋 Tabla de Contenidos

- [Arquitectura General](#-arquitectura-general)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos](#-requisitos)
- [Configuración del Entorno](#️-configuración-del-entorno)
- [Flujo de Datos](#-flujo-de-datos)
- [Caché de Reportes](#-caché-de-reportes)
- [CI/CD — Despliegue Automático](#-cicd--despliegue-automático)
- [Variables y Credenciales](#-variables-y-credenciales)
- [Documentación Técnica](#-documentación-técnica)

---

## 🏗 Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (Usuario)                    │
│          index.html  ←  fetch()  →  BackEnd/getReport.php   │
└──────────────────────────┬──────────────────────────────────┘
                           │
               ┌───────────▼───────────┐
               │   BackEnd/getReport.php│
               │   ┌─────────────────┐ │
               │   │  cache/         │ │  TTL: 10 min
               │   │  report_cache   │ │  Fallback: stale
               │   │  .xml           │ │
               │   └────────┬────────┘ │
               │            │ MISS      │
               └────────────┼──────────┘
                            │
               ┌────────────▼──────────┐
               │  Oracle Fusion Cloud  │
               │  BI Publisher (SOAP)  │
               │  XXALM_LOTE_ONHAND    │
               └───────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
rptOnHandWeb/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Pipeline CI/CD (rsync → servidor)
│
├── BackEnd/
│   ├── getReport.php           # Integración SOAP + caché (CORE)
│   ├── getItemImage.php        # Resolver imágenes por código de artículo
│   ├── test.php                # Utilidad diagnóstico SSL/cURL
│   ├── cacert.pem              # Bundle de certificados CA (Mozilla)
│   └── cache/
│       ├── .htaccess           # Deny from all (protege el caché)
│       └── report_cache.xml    # Caché generado (git-ignored)
│
├── assets/
│   ├── Logo_ALMEX_SVG.svg
│   ├── Montserrat-*.ttf
│   └── items/
│       └── {ITEM_CODE}/        # Una carpeta por artículo
│           └── {ITEM_CODE}.jpg # Imagen del artículo
│
├── css/
│   ├── AlmexStyle.css          # Estilos corporativos ALMEX
│   ├── bootstrap@5.1.3 (local)
│   └── font-awesome@6.0.0 (local)
│
├── js/
│   ├── box-upload.js
│   ├── pdf.js / pdf-lib.js     # Librerías PDF (locales)
│   └── jquery-3.6.0.js
│
├── vendor/
│   ├── bootstrap-5.0.0-dist/
│   └── fontawesome-5.15.3/
│
└── index.html                  # SPA — punto de entrada único
```

> **Nota:** `BackEnd/cache/report_cache.xml` está en `.gitignore` — se genera en runtime.

---

## ✅ Requisitos

| Componente | Versión mínima | Notas |
|---|---|---|
| PHP | 8.0+ | Extensiones: `curl`, `dom`, `fileinfo` |
| Apache / Nginx | Cualquier estable | Módulo `mod_rewrite` habilitado |
| cURL | 7.x+ | Con soporte SSL/TLS |
| Permisos | `BackEnd/cache/` writable | `chmod 755` o `www-data` owner |
| Red | Salida HTTPS al cloud Oracle | Puerto 443 desbloqueado |

---

## ⚙️ Configuración del Entorno

### 1. Zona horaria PHP

En `php.ini` o al inicio de `getReport.php`:

```php
date_default_timezone_set('America/Mexico_City');
```

### 2. Permisos del directorio de caché

```bash
mkdir -p BackEnd/cache
chmod 755 BackEnd/cache
# Si el servidor corre como www-data:
chown www-data:www-data BackEnd/cache
```

### 3. Certificado SSL

El archivo `BackEnd/cacert.pem` es el bundle de Mozilla para validar la conexión HTTPS con Oracle. Si expira o falla:

```bash
# Descargar versión actualizada
curl -o BackEnd/cacert.pem https://curl.se/ca/cacert.pem
```

---

## 🔄 Flujo de Datos

```
Browser
  │
  │ 1. fetch("BackEnd/getReport.php")
  ▼
getReport.php
  │
  ├─► ¿Existe cache y tiene < 10 min? ──YES──► readfile(cache) ──► Browser
  │                                                   + X-Cache-Hit: true
  │ NO
  ▼
  SOAP → Oracle BI Publisher
          reportBytes (base64 XML)
  │
  ▼
  file_put_contents(cache/report_cache.xml)
  echo $response ──► Browser
       + X-Cache-Hit: false
       + X-Cache-Updated: <ISO8601 con offset TZ>
  │
  ▼ (en Browser / JavaScript)
  DOMParser → getElementsByTagNameNS("reportBytes")
  → atob(base64) → UTF-8 decode → XML DOM
  → getElementsByTagName("G_LOTE")
  → renderStandardTable() + renderGearPage()
```

---

## 💾 Caché de Reportes

| Parámetro | Valor |
|---|---|
| Archivo | `BackEnd/cache/report_cache.xml` |
| TTL | 10 minutos (`600` segundos) |
| Estrategia | File-based, sin dependencias externas |
| Fallback | Sirve caché vencida si Oracle no responde (`X-Cache-Hit: stale`) |
| Protección | `.htaccess` bloquea acceso web directo |

### Headers de respuesta

```
X-Cache-Updated: 2026-04-07T12:30:00-06:00   ← ISO 8601 con offset TZ
X-Cache-Hit:     true | false | stale
```

El frontend lee `X-Cache-Updated` y lo muestra al usuario con `toLocaleString('es-MX')`.

> 📖 Ver documentación detallada: [`doc/caching.md`](doc/caching.md)

---

## 🚀 CI/CD — Despliegue Automático

El pipeline `.github/workflows/deploy.yml` se ejecuta en cada push a `main`.

```
Push a main
     │
     ▼
[GitHub Actions — Self-Hosted Runner]
     │
     ├─► Stage: deploy
     │     rsync -av --exclude='.git' → /var/www/{repo}_{branch}/
     │
     └─► Stage: composer (si existe composer.json)
           composer install --no-dev --optimize-autoloader
```

**Runner:** Self-hosted en el servidor de producción (`runs-on: self-hosted`).

> 📖 Ver documentación detallada: [`doc/deployment.md`](doc/deployment.md)

---

## 🔐 Variables y Credenciales

> ⚠️ Las credenciales de Oracle están embebidas en `getReport.php`. Para mayor seguridad considera variables de entorno o un archivo fuera del webroot.

| Elemento | Descripción |
|---|---|
| `Authorization: Basic` | Credenciales de servicio OTBI en Oracle Fusion (Base64) |
| `cacert.pem` | Bundle CA Mozilla para verificación SSL con Oracle Cloud |
| `CURLOPT_CAINFO` | Ruta absoluta: `__DIR__ . "/cacert.pem"` |

---

## 📚 Documentación Técnica

| Documento | Descripción |
|---|---|
| [`doc/architecture.md`](doc/architecture.md) | Arquitectura completa, integraciones y decisiones de diseño |
| [`doc/oracle-integration.md`](doc/oracle-integration.md) | Integración SOAP con Oracle BI Publisher |
| [`doc/caching.md`](doc/caching.md) | Estrategia de caché, headers y comportamiento de fallback |
| [`doc/frontend.md`](doc/frontend.md) | Pipeline de parseo XML, vistas y componentes JS |
| [`doc/deployment.md`](doc/deployment.md) | CI/CD, self-hosted runner y requisitos de servidor |

---

**Departamento de Operaciones Logísticas — ALMEX**
Uso exclusivo interno.
