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

## Mercado Pago: credenciales de sandbox (test) y puesta en marcha

La app usa el SDK Node v3 (`mercadopago@3.4.0`) con clientes instanciados en `lib/mercadopago/client.ts`. La mensualidad se materializa recién cuando el webhook `subscription_preapproval` confirma la autorización (el endpoint `POST /api/pagos/mensualidad` solo crea el PreApproval y nunca crea una fila por sí solo).

### 1) Crear cuentas de test (sandbox)
1. Entrar en [https://www.mercadopago.com.uy/developers](https://www.mercadopago.com.uy/developers) (o el panel de developers de tu país) con una cuenta de Mercado Pago real del negocio (la de Beto).
2. Ir a **"Tus integraciones" → "Credenciales"**.
3. Para pruebas usar las credenciales **de prueba** (test), no las productivas:
   - **Access Token de prueba** → `MERCADOPAGO_ACCESS_TOKEN`.
   - Copia del **"Llave secreta"** de pruebas → `MERCADOPAGO_WEBHOOK_SECRET` (usada para verificar la firma `x-signature` de los webhooks).
4. En **"Cuentas de prueba"** crear 2 usuarios de prueba (comprador y vendedor). El comprador necesita una tarjeta de prueba (las tarjetas de prueba de Mercado Pago, ej. `5031 7557 3453 0604` para Mastercard aprobada, se listan en la tabla oficial de tarjetas de prueba del panel).

### 2) Configurar las variables de entorno
Agregar a `.env` (y a `.env.example`):
```
# Solo para que el e2e de Mercado Pago corra de verdad (no falsas; se omiten en CI si faltan)
MERCADOPAGO_ACCESS_TOKEN=TEST-...tu token de prueba...
MERCADOPAGO_WEBHOOK_SECRET=TEST-...tu llave secreta de prueba...
```
- Sin `MERCADOPAGO_ACCESS_TOKEN`, el e2e `booking.spec.ts` ("una clase paga sin mensualidad redirige a Mercado Pago") queda `skip` condicional. Con la variable seteada el test corre y debe navegar a `mercadopago.com/checkout`.
- En producción se reemplazan por las credenciales productivas (mismo `MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_WEBHOOK_SECRET`, ese acceso token NO comienza con `TEST-`).

### 3) Habilitar webhooks en el tablero de MP
1. En el panel de MP → **"Tus integraciones" → "Webhooks (notificaciones)"** (o API: `POST /users/:id/webhooks/notifications`).
2. Configurar la URL como `https://<dominio>/api/webhooks/mercadopago`, evento **"Versión 1"**, con **"Método de envío" HTTPS**.
3. El endpoint valida la firma `x-signature` usando `MERCADOPAGO_WEBHOOK_SECRET`; una URL pública es obligatoria durante el desarrollo real del flujo en local se puede usar un túnel (ngrok/cloudflared) apuntando a `http://localhost:3000/api/webhooks/mercadopago`.

### 4) Probar el flujo completo contra sandbox
1. Con las credenciales de test en `.env`, correr `npm run dev`.
2. Loguearse como un cliente de prueba, reservar una clase paga (o iniciar una mensualidad) y completar el pago con una tarjeta de prueba.
3. Verificar en la DB: el `Pago` pasa a `APROBADO` y se crea la `Reserva`; para mensualidad, la `Suscripcion` aparece en `ACTIVA` recién después del webhook `subscription_preapproval`.

## Reset de la base de datos (no interactivo)

`prisma migrate reset` es una operación peligrosa y Prisma la bloquea cuando la invoca una herramienta de IA. Suelto en un contenedor efímero, para correr un reset fuera de un entorno interactivo hay que inyectar el consentimiento explícito:
```powershell
$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = "autorizado reset db test 5433"
npx prisma migrate reset --force   # SOLO contra una DB de test local (localhost:5433)
```
**Solo usar contra bases de desarrollo/test.** No hardcodear en el repo; se inyecta como variable de entorno al correr los comandos.