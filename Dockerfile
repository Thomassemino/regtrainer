# Dockerfile multi-stage para Beto Training (Next.js 16 standalone)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-jammy AS runner
WORKDIR /app
ENV NODE_ENV=production
# El server standalone de Next bindea por defecto al HOSTNAME que le da Docker
# (id del contenedor), NO a 0.0.0.0; el healthcheck y los proxies del host no lo
# alcanzan. Forzando HOSTNAME=0.0.0.0 escucha en todas las interfaces.
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]