<?php

$ca = "cacert.pem";
$cacheFile = __DIR__ . '/cache/report_cache.xml';
$cacheTTL  = 10 * 60; // 10 minutos en segundos

// ── Servir desde caché si es válida ──────────────────────────────────────────
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTTL) {
    $lastUpdated = date('c', filemtime($cacheFile));
    header('Content-Type: text/xml; charset=UTF-8');
    header('X-Cache-Updated: ' . $lastUpdated);
    header('X-Cache-Hit: true');
    readfile($cacheFile);
    exit;
}

// ── Crear directorio de caché si no existe ───────────────────────────────────
if (!is_dir(__DIR__ . '/cache')) {
    mkdir(__DIR__ . '/cache', 0755, true);
}

// ── Llamada SOAP a Oracle ────────────────────────────────────────────────────
$ca  = __DIR__ . "/cacert.pem";
$url = "https://fa-enkq-saasfaprod1.fa.ocs.oraclecloud.com/xmlpserver/services/ExternalReportWSSService";
$soap = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
    xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">
  <soap:Header/>
  <soap:Body>
    <pub:runReport>
      <pub:reportRequest>
        <pub:attributeFormat>xml</pub:attributeFormat>
        <pub:reportAbsolutePath>/Custom/Inventory/Integration/XXALM_LOTE_ONHAND_REP.xdo</pub:reportAbsolutePath>
        <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>
      </pub:reportRequest>
    </pub:runReport>
  </soap:Body>
</soap:Envelope>
XML;

$ch = curl_init($url);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        "Content-Type: application/soap+xml; charset=UTF-8",
        "SOAPAction: runReport",
        "Authorization: Basic T1RCSV9NQVRSSVg6O0FOeXshMW81OSxFaC0hd1dQcjU="
    ],
    CURLOPT_POSTFIELDS    => $soap,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_CAINFO         => $ca,
    CURLOPT_CONNECTTIMEOUT => 300,
    CURLOPT_TIMEOUT        => 300
]);

$response = curl_exec($ch);

if ($response === false) {
    // Si ya existe una caché vieja, devolverla como fallback
    if (file_exists($cacheFile)) {
        $lastUpdated = date('c', filemtime($cacheFile));
        header('Content-Type: text/xml; charset=UTF-8');
        header('X-Cache-Updated: ' . $lastUpdated);
        header('X-Cache-Hit: stale');
        readfile($cacheFile);
    } else {
        http_response_code(503);
        echo "CURL ERROR: " . curl_error($ch);
    }
    curl_close($ch);
    exit;
}

curl_close($ch);

// ── Guardar en caché ─────────────────────────────────────────────────────────
file_put_contents($cacheFile, $response);

$lastUpdated = date('c');
header('Content-Type: text/xml; charset=UTF-8');
header('X-Cache-Updated: ' . $lastUpdated);
header('X-Cache-Hit: false');

echo $response;
