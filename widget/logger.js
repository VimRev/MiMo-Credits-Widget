const fs = require('fs');
const path = require('path');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 7;
const SENSITIVE_KEYS = ['token', 'cookie', 'authorization', 'password', 'secret', 'apikey'];

let logDir = null;
let currentFile = null;
let currentSize = 0;
let minLevel = LEVELS.info;

function getLogDir() {
  if (logDir) return logDir;
  const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
  logDir = path.join(appData, 'MiMo-Credits-Widget', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function getLogFile() {
  const dateStr = getDateStr();
  const expected = path.join(getLogDir(), `mimo-${dateStr}.log`);
  if (currentFile && currentFile === expected && currentSize < MAX_FILE_SIZE) return currentFile;
  currentFile = expected;
  try { currentSize = fs.statSync(currentFile).size; } catch { currentSize = 0; }
  return currentFile;
}

function rotateIfNeeded() {
  if (currentSize < MAX_FILE_SIZE) return;
  const dir = getLogDir();
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('mimo-') && f.endsWith('.log'))
    .sort()
    .reverse();
  for (let i = MAX_FILES; i < files.length; i++) {
    try { fs.unlinkSync(path.join(dir, files[i])); } catch {}
  }
}

function sanitize(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/(token|cookie|authorization|password|secret|apikey)[=:]\s*["']?[^"'&\s,}]+/gi,
      (m, k) => k + '=***');
  }
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
      out[k] = '***';
    } else if (typeof v === 'object' && v !== null) {
      out[k] = sanitize(v);
    } else if (typeof v === 'string') {
      out[k] = sanitize(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function formatLine(level, source, message, meta) {
  const ts = new Date().toISOString();
  const lvl = LEVEL_NAMES[level] || 'INFO';
  let line = `[${ts}] [${lvl}] [${source}] ${sanitize(message)}`;
  if (meta !== undefined) {
    const safe = sanitize(meta);
    line += ` | ${JSON.stringify(safe)}`;
  }
  return line;
}

function writeLine(line) {
  const file = getLogFile();
  rotateIfNeeded();
  const buf = Buffer.from(line + '\n', 'utf8');
  try {
    fs.appendFileSync(file, buf);
    currentSize += buf.length;
  } catch {}
}

function log(level, source, message, meta) {
  if (level < minLevel) return;
  writeLine(formatLine(level, source, message, meta));
}

module.exports = {
  setMinLevel(level) { minLevel = LEVELS[level] ?? LEVELS.info; },

  debug(source, msg, meta) { log(LEVELS.debug, source, msg, meta); },
  info(source, msg, meta)  { log(LEVELS.info,  source, msg, meta); },
  warn(source, msg, meta)  { log(LEVELS.warn,  source, msg, meta); },
  error(source, msg, meta) { log(LEVELS.error, source, msg, meta); },

  logFromRenderer(level, message, meta) {
    log(LEVELS[level] ?? LEVELS.info, 'renderer', message, meta);
  },
};
