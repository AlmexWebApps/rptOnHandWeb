<?php
$ch = curl_init("https://www.google.com");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$r = curl_exec($ch);

echo "<br>";

var_dump(ini_get("curl.cainfo"));
var_dump(ini_get("openssl.cafile"));

echo "<br>";
$ch = curl_init("https://www.google.com");

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CAINFO, "C:\php\\extras\ssl\cacert.pem");

$r = curl_exec($ch);

if ($r === false) {
    echo curl_error($ch);
} else {
    echo "SSL OK";
}
