import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("backups", { recursive: true });
const file = `backups/beto_training_${timestamp}.sql`;

execSync(`pg_dump "${process.env.DATABASE_URL}" > ${file}`, { stdio: "inherit" });
console.log(`Backup escrito en ${file}`);