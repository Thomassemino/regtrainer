# Operaciones — Beto Training

## Primer despliegue
1. Copiar `.env.example` a `.env`, completar `POSTGRES_PASSWORD` y `AUTH_SECRET` (generar con `openssl rand -base64 32`), `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
2. `docker compose up -d db`
3. `docker compose run --rm migrate` (aplica migraciones y levanta el seed; si faltan `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` sigue sin admin, no aborta)
4. `docker compose up -d --build app`
5. Loguearse como admin y cambiar la contraseña seedeada desde "Mis datos" inmediatamente.

> **Self-host**: la app corre autenticada detrás de tu proxy inverso con `trustHost` habilitado directamente en el código (`lib/auth.ts`). No hace falta setear `AUTH_TRUST_HOST` como variable de entorno.

## DNS para que los emails no caigan en spam (SMTP propio)
Antes de que el registro/recuperación de contraseña funcione de forma confiable en producción, configurar en el DNS del dominio real:
- **SPF** (`TXT` en el dominio raíz): `v=spf1 ip4:<IP del servidor> -all`
- **DKIM** (`TXT` en `default._domainkey.<dominio>`): clave pública generada por el contenedor `smtp` (`docker compose exec smtp postfix-dkim-key-show`, o el comando equivalente según la imagen usada — revisar la documentación de la imagen `boky/postfix` vigente al momento del despliegue).
- **DMARC** (`TXT` en `_dmarc.<dominio>`): `v=DMARC1; p=quarantine; rua=mailto:postmaster@<dominio>`

Sin esto, los emails de verificación/reset probablemente lleguen a spam o sean rechazados por Gmail/Outlook.

## Rate limiting y proxy inverso

El rate limiting por IP requiere un proxy inverso confiable (Nginx/Caddy) delante de la app que sobrescriba `X-Forwarded-For` / `X-Real-IP` con la IP real del cliente. Cuando la app está detrás de ese proxy, setear `TRUST_PROXY=1` para que esas cabeceras se usen como IP del cliente.

Sin proxy confiable (o con `TRUST_PROXY` sin setear — valor por defecto), la app **ignora las cabeceras del cliente** y reporta IP `unknown`: no se puede falsificar la IP vía `X-Forwarded-For` y los límites se aplican **solo por email** — no es posible distinguir clientes distintos por dirección, así que los intentos fallidos de un mismo email acumulan contra el bucket de ese email sin importar desde dónde vengan.

Si no hay proxy confiable, no publicar la app directo contra internet esperando límites por IP; confiar solo en los límites por email (comportamiento por defecto actual).

## Backups
El script `scripts/backup.ts` usa `pg_dump` y requiere el cliente de Postgres instalado en la maquina que lo corre. En el servidor conviene delegar al contenedor `db`:
```
0 3 * * * cd /ruta/al/repo && docker compose exec -T db pg_dump -U beto beto_training | gzip > backups/beto_$(date +\%Y\%m\%d).sql.gz
```
Alternativa local (si tenes postgres-client): `npm run db:backup`.