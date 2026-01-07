# 🔌 Integración con Oracle BI Publisher

## Endpoint SOAP

| Campo         | Valor                                                                                             |
|---------------|---------------------------------------------------------------------------------------------------|
| URL           | `https://fa-enkq-saasfaprod1.fa.ocs.oraclecloud.com/xmlpserver/services/ExternalReportWSSService` |
| Protocolo     | SOAP 1.2 sobre HTTPS                                                                              |
| Operación     | `runReport`                                                                                       |
| Namespace     | `http://xmlns.oracle.com/oxp/service/PublicReportService`                                         |
| Autenticación | HTTP Basic Auth (usuario de servicio OTBI)                                                        |

---

## Reporte Ejecutado

| Campo             | Valor                                                     |
|-------------------|-----------------------------------------------------------|
| Ruta absoluta     | `/Custom/Inventory/Integration/XXALM_LOTE_ONHAND_REP.xdo` |
| Formato de salida | `xml`                                                     |
| Chunk size        | `-1` (descarga completa, sin paginación)                  |

El reporte `XXALM_LOTE_ONHAND_REP` es un reporte custom desarrollado en Oracle BI Publisher que extrae el saldo On-Hand por lote de todas las organizaciones de inventario configuradas.

---

## Estructura del Request SOAP

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
    xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">
  <soap:Header/>
  <soap:Body>
    <pub:runReport>
      <pub:reportRequest>
        <pub:attributeFormat>xml</pub:attributeFormat>
        <pub:reportAbsolutePath>
          /Custom/Inventory/Integration/XXALM_LOTE_ONHAND_REP.xdo
        </pub:reportAbsolutePath>
        <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>
      </pub:reportRequest>
    </pub:runReport>
  </soap:Body>
</soap:Envelope>
```

---

## Estructura de la Respuesta SOAP

```xml
<soap:Envelope>
  <soap:Body>
    <pub:runReportResponse>
      <pub:reportResponse>
        <pub:reportBytes>
          BASE64_ENCODED_XML_DATA_HERE
        </pub:reportBytes>
      </pub:reportResponse>
    </pub:runReportResponse>
  </soap:Body>
</soap:Envelope>
```

El campo `reportBytes` contiene el XML del reporte codificado en Base64. El tamaño típico del XML descomprimido es ~2 MB.

---

## Estructura del XML de Datos (decodificado)

```xml
<DATA_DS>
  <G_LOTE>
    <ORGANIZATION_CODE>ALM1</ORGANIZATION_CODE>
    <ITEM_NUMBER>020-001-005</ITEM_NUMBER>
    <ITEM_DESC>Motor Industrial 5HP</ITEM_DESC>
    <SUBINVENTORY_CODE>PT</SUBINVENTORY_CODE>
    <QTY_ONHAND>24</QTY_ONHAND>
    <LOT_NUMBER>L-9982-24</LOT_NUMBER>
    <EXPIRATION_DATE>2028-05-20</EXPIRATION_DATE>
  </G_LOTE>
  <G_LOTE>
    ...
  </G_LOTE>
</DATA_DS>
```

---

## Configuración cURL

```php
CURLOPT_SSL_VERIFYPEER => true,    // Verificar certificado del servidor
CURLOPT_SSL_VERIFYHOST => 2,       // Verificar hostname del certificado
CURLOPT_CAINFO         => __DIR__ . "/cacert.pem",  // CA bundle Mozilla
CURLOPT_CONNECTTIMEOUT => 300,     // 5 min timeout de conexión
CURLOPT_TIMEOUT        => 300,     // 5 min timeout total
```

> **¿Por qué 300 segundos?** El reporte Oracle puede tardar entre 30 y 120 segundos en generarse dependiendo del volumen de datos. El timeout largo evita cortes prematuros.

---

## Renovación del Certificado CA

El archivo `cacert.pem` es el bundle de autoridades certificadoras de Mozilla. Oracle Cloud usa certificados firmados por DigiCert, que está incluido en este bundle.

**Síntoma de certificado vencido:**
```
CURL ERROR: SSL certificate problem: certificate has expired
```

**Solución:**
```bash
curl -o BackEnd/cacert.pem https://curl.se/ca/cacert.pem
```

---

## Diagnóstico SSL

Usar `BackEnd/test.php` para verificar que PHP puede establecer conexiones HTTPS correctamente:

```
http://tu-servidor/BackEnd/test.php
```

Salida esperada: `SSL OK`

---

## Credenciales de Servicio

El usuario de integración en Oracle Fusion Cloud es del tipo **OTBI Service Account**. Debe tener el rol:
- `BI Author Role` o equivalente para poder ejecutar reportes via API

Las credenciales se codifican en Base64 y se envían en el header `Authorization: Basic <base64>`.

> ⚠️ Si el password del usuario de servicio cambia en Oracle, regenerar el Base64:
> ```php
> echo base64_encode("USUARIO:NUEVO_PASSWORD");
> ```
> Y actualizar la línea correspondiente en `getReport.php`.
