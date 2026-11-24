import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadServerEnvironment } from './environment.js';

export async function runMigrations(
  pool: Pool,
  migrationsUrl = new URL('../migrations/', import.meta.url),
): Promise<string[]> {
  const directory = fileURLToPath(migrationsUrl);
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum character(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const file of files) {
      const sql = await readFile(`${directory}${file}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock(724198201)');
        const existing = await client.query<{ checksum: string }>(
          'SELECT checksum FROM schema_migrations WHERE name = $1',
          [file],
        );
        const previous = existing.rows[0];
        if (previous && previous.checksum !== checksum) {
          throw new Error(`已应用迁移${file}的checksum发生变化`);
        }
        if (!previous) {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
            file,
            checksum,
          ]);
          applied.push(file);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return applied;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const config = loadServerEnvironment();
  if (config.databaseUrl === null) {
    throw new TypeError('迁移必须配置DATABASE_URL');
  }
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    const applied = await runMigrations(pool);
    process.stdout.write(`${JSON.stringify({ applied })}\n`);
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : '数据库迁移失败'}\n`);
  process.exitCode = 1;
});
