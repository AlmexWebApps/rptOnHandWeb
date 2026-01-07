<?php

$item = $_GET['item'] ?? '';
$basePath = "assets/items/$item/$item";



$extensiones = [".jpg", ".jpeg", ".png", ".bmp", ".gif"];

foreach ($extensiones as $ext) {
    if (file_exists("../".$basePath . $ext)) {
        echo ($basePath . $ext);
        continue;
    }
}

