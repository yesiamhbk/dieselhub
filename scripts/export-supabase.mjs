import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.env.BACKUP_ROOT || '/Users/hbk/Documents/Codex/2026-08-13/referenced-chatgpt-conversation-this-is-an';
const envFile = process.env.BACKUP_ENV_FILE || path.join(root, 'outputs/render-production.env.backup');
const envText = await fs.readFile(envFile, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => {
  const at = line.indexOf('=');
  return [line.slice(0, at), line.slice(at + 1).replace(/\\n/g, '\n')];
}));
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = process.env.BACKUP_OUTPUT_DIR || path.join(root, 'outputs', `supabase-backup-${stamp}`);
await fs.mkdir(path.join(out, 'tables'), { recursive: true });
await fs.mkdir(path.join(out, 'storage'), { recursive: true });

const schemaResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
if (!schemaResponse.ok) throw new Error(`PostgREST schema: HTTP ${schemaResponse.status}`);
await fs.writeFile(path.join(out, 'postgrest-openapi-schema.json'), `${JSON.stringify(await schemaResponse.json(), null, 2)}\n`, { mode: 0o600 });

const tables = (process.env.BACKUP_TABLES || 'accessories,admins,order_counters,order_day_counters,order_items,orders,orders_old,product_compat,product_images,products').split(',').map(value => value.trim()).filter(Boolean);
const projectRef = env.SUPABASE_URL?.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] || 'unknown';
const manifest = { createdAt: new Date().toISOString(), projectRef, outputDirectory: out, tables: {}, storage: {} };
for (const table of tables) {
  const rows = [];
  for (let from = 0;; from += 1000) {
    const { data, error } = await client.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  await fs.writeFile(path.join(out, 'tables', `${table}.json`), JSON.stringify(rows, null, 2) + '\n', { mode: 0o600 });
  manifest.tables[table] = { rows: rows.length };
  console.log(`[backup] table ${table}: ${rows.length}`);
}

const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
if (bucketsError) throw new Error(`storage buckets: ${bucketsError.message}`);
for (const bucket of buckets || []) {
  const objects = [];
  const queue = [''];
  while (queue.length) {
    const prefix = queue.shift();
    for (let offset = 0;; offset += 1000) {
      const { data, error } = await client.storage.from(bucket.id).list(prefix, { limit: 1000, offset });
      if (error) throw new Error(`storage ${bucket.id}/${prefix}: ${error.message}`);
      for (const entry of data || []) {
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) objects.push(objectPath); else queue.push(objectPath);
      }
      if (!data || data.length < 1000) break;
    }
  }
  let downloaded = 0;
  for (const objectPath of objects) {
    const target = path.join(out, 'storage', bucket.id, objectPath);
    try {
      await fs.access(target);
      downloaded++;
      continue;
    } catch {}
    const { data, error } = await client.storage.from(bucket.id).download(objectPath);
    if (error) throw new Error(`download ${bucket.id}/${objectPath}: ${error.message}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(await data.arrayBuffer()), { mode: 0o600 });
    downloaded++;
    if (downloaded % 25 === 0 || downloaded === objects.length) console.log(`[backup] storage ${bucket.id}: ${downloaded}/${objects.length}`);
  }
  manifest.storage[bucket.id] = { public: bucket.public, objects: downloaded };
}
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(manifest, null, 2));
