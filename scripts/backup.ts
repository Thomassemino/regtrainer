import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

// Requiere pg_dump (cliente de Postgres) en el PATH.
// Alternativa dentro de docker (no necesita client local):
//   docker compose exec db pg_dump -U beto beto_training | gzip > backups/beto_$(date +%Y%m%d).sql.gz
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("backups", { recursive: true });
const file = `backups/beto_training_${timestamp}.sql`;

execSync(`pg_dump "${process.env.DATABASE_URL}" > ${file}`, { stdio: "inherit" });
console.log(`Backup escrito en ${file}`);