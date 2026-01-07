# 🚀 Despliegue y CI/CD

## Resumen

El despliegue es completamente automatizado via **GitHub Actions** con un **self-hosted runner** instalado en el servidor de producción. Cada push a `main` dispara el pipeline.

---

## Pipeline — `.github/workflows/deploy.yml`

```
git push → main
      │
      ▼
  GitHub Actions trigger
      │
      ├─► Job: deploy
      │     1. actions/checkout@v3
      │     2. mkdir -p /var/www/{repo}_{branch}
      │     3. rsync -av --exclude='.git' ./ /var/www/{repo}_{branch}/
      │
      └─► Job: composer  (depende de 'deploy')
            4. Si existe composer.json:
               composer install --no-dev --optimize-autoloader
```

---

## Directorio de Despliegue

El destino del rsync es:
```
/var/www/{REPO_NAME}_{BRANCH_NAME}/
```

Para este proyecto (repo `rptOnHandWeb`, rama `main`):
```
/var/www/rptOnHandWeb_main/
```

---

## Self-Hosted Runner

El runner está instalado en el servidor Apache de producción como servicio del sistema. Esto permite que el pipeline acceda directamente al filesystem del servidor sin necesidad de SSH externo.

### Verificar estado del runner

```bash
# Ver estado del servicio
systemctl status actions.runner.*.service

# Ver logs del runner
journalctl -u actions.runner.*.service -f
```

### Reinstalar runner (si es necesario)

Ir a: `Repositorio → Settings → Actions → Runners → New self-hosted runner` y seguir las instrucciones actualizadas de GitHub.

---

## Requisitos del Servidor

| Requisito      | Detalle                                                               |
|----------------|-----------------------------------------------------------------------|
| OS             | Linux (Ubuntu/Debian recomendado)                                     |
| Web server     | Apache 2.4+ con `mod_rewrite` y PHP 8.x                               |
| PHP extensions | `curl`, `dom`, `fileinfo`, `mbstring`                                 |
| Permisos       | El usuario del runner debe poder escribir en `/var/www/`              |
| Red saliente   | Puerto 443 abierto hacia `fa-enkq-saasfaprod1.fa.ocs.oraclecloud.com` |
| GitHub runner  | Instalado como servicio systemd                                       |

---

## Virtual Host Apache (ejemplo)

```apache
<VirtualHost *:80>
    ServerName inventarios.almex.local
    DocumentRoot /var/www/rptOnHandWeb_main

    <Directory /var/www/rptOnHandWeb_main>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Logs
    ErrorLog  ${APACHE_LOG_DIR}/inventarios_error.log
    CustomLog ${APACHE_LOG_DIR}/inventarios_access.log combined
</VirtualHost>
```

> `Options -Indexes` es importante para no exponer listados de directorios.

---

## Primera Instalación

```bash
# 1. Clonar repositorio (solo primera vez)
cd /var/www
git clone https://github.com/ALMEX-ORG/rptOnHandWeb.git rptOnHandWeb_main

# 2. Crear directorio de caché y asignar permisos
mkdir -p /var/www/rptOnHandWeb_main/BackEnd/cache
chown www-data:www-data /var/www/rptOnHandWeb_main/BackEnd/cache
chmod 755 /var/www/rptOnHandWeb_main/BackEnd/cache

# 3. Verificar el .htaccess de caché
cat /var/www/rptOnHandWeb_main/BackEnd/cache/.htaccess
# Debe mostrar: Deny from all

# 4. Reiniciar Apache
systemctl restart apache2
```

A partir de aquí, el CI/CD maneja los deployments automáticamente.

---

## Archivos Excluidos del Deploy

El rsync excluye `.git/`. El caché XML (`BackEnd/cache/report_cache.xml`) también está en `.gitignore` y por tanto no se versiona ni se sobreescribe en deploys.

---

## Rollback Manual

```bash
# Ver commits anteriores
git log --oneline -10

# Hacer checkout de un commit anterior en el servidor
cd /var/www/rptOnHandWeb_main
git fetch origin
git checkout <commit-hash>
systemctl reload apache2
```

---

## Diagnóstico Post-Deploy

```bash
# Ver últimos errores PHP/Apache
tail -50 /var/log/apache2/inventarios_error.log

# Verificar permisos del caché
ls -la /var/www/rptOnHandWeb_main/BackEnd/cache/

# Probar endpoint directamente
curl -I http://localhost/BackEnd/getReport.php
# Debe retornar: X-Cache-Hit: true|false
```

---

## Checklist de Deploy Inicial

- [ ] Apache configurado con VirtualHost correcto
- [ ] PHP 8.x instalado con extensiones `curl`, `dom`
- [ ] `BackEnd/cache/` existe con permisos de escritura para `www-data`
- [ ] `BackEnd/cacert.pem` presente (no está en `.gitignore`)
- [ ] Puerto 443 de salida desbloqueado hacia Oracle
- [ ] Self-hosted runner activo y registrado en el repositorio
- [ ] Primer acceso a `index.html` carga datos correctamente
- [ ] `X-Cache-Updated` muestra hora correcta (zona horaria configurada)
