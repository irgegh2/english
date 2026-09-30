import fs from 'node:fs';
import crypto from 'node:crypto';

const envPath = '.env';
const command = process.argv[2] || '';

function readEnvText() {
  if (!fs.existsSync(envPath)) throw new Error('.env not found');
  return fs.readFileSync(envPath, 'utf8');
}

function getEnvValue(text, key) {
  const match = text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function setEnvValue(text, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}\\s*=.*$`, 'm');
  if (re.test(text)) return text.replace(re, line);
  return `${text}${text.endsWith('\n') ? '' : '\n'}${line}\n`;
}

if (command === 'source-url') {
  const text = readEnvText();
  const value = getEnvValue(text, 'DATABASE_URL');
  if (!value) throw new Error('DATABASE_URL not found in .env');
  const url = new URL(value);
  url.searchParams.delete('schema');
  process.stdout.write(url.toString());
} else if (command === 'master-key') {
  const text = readEnvText();
  const existing = getEnvValue(text, 'STORAGE_MASTER_KEY');
  process.stdout.write(existing || crypto.randomBytes(32).toString('hex'));
} else if (command === 'write-cloud-env') {
  const target = process.env.TARGET_PRISMA_URL || '';
  const masterKey = process.env.MASTER_KEY || '';
  if (!target) throw new Error('TARGET_PRISMA_URL is required');
  if (!masterKey) throw new Error('MASTER_KEY is required');

  let text = readEnvText();
  text = setEnvValue(text, 'DATABASE_URL', target);
  text = setEnvValue(text, 'STORAGE_MASTER_KEY', masterKey);
  if (!getEnvValue(text, 'PORT')) text = setEnvValue(text, 'PORT', '8787');
  fs.writeFileSync(envPath, text);
} else {
  throw new Error(`Unknown command: ${command}`);
}
