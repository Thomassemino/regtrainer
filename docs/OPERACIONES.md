# Operaciones — Beto Training

## Primer despliegue
1. Copiar `.env.example` a `.env`, completar `POSTGRES_PASSWORD` y `AUTH_SECRET` (generar con `openssl rand -base64 32`), `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
2. `docker compose up -d --build`
3. `docker compose exec app npm run db:migrate`
4. `docker compose exec app npm run db:seed`
5. Loguearse como admin y cambiar la contraseña seedeada desde "Mis datos" inmediatamente.

## DNS para que los emails no caigan en spam (SMTP propio)
Antes de que el registro/recuperación de contraseña funcione de forma confiable en producción, configurar en el DNS del dominio real:
- **SPF** (`TXT` en el dominio raíz): `v=spf1 ip4:<IP del servidor> -all`
- **DKIM** (`TXT` en `default._domainkey.<dominio>`): clave pública generada por el contenedor `smtp` (`docker compose exec smtp postfix-dkim-key-show`, o el comando equivalente según la imagen usada — revisar la documentación de la imagen `boky/postfix` vigente al momento del despliegue).
- **DMARC** (`TXT` en `_dmarc.<dominio>`): `v=DMARC1; p=quarantine; rua=mailto:postmaster@<dominio>`

Sin esto, los emails de verificación/reset probablemente lleguen a spam o sean rechazados por Gmail/Outlook.

## Backups
`npm run db:backup` corre `pg_dump` a un archivo con timestamp en `./backups/`. Programar por cron en el servidor, por ejemplo diario a las 3am:
```
0 3 * * * cd /ruta/al/repo && docker compose exec -T app npm run db:backup
```