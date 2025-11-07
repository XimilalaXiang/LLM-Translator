import fs from 'fs';
import path from 'path';

const LOG_FILE = process.env.SYSTEM_LOG_FILE || path.resolve(process.cwd(), 'data/system.log');

function ensureDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function logInfo(message: string) {
  try {
    ensureDir();
    const line = `[INFO] ${new Date().toISOString()} ${message}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

export function logError(message: string) {
  try {
    ensureDir();
    const line = `[ERROR] ${new Date().toISOString()} ${message}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

export function getLogFilePath() {
  return LOG_FILE;
}


