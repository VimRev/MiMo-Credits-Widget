/**
 * MiMo Credits Widget -- Renderer
 * Reads credits from the local service and keeps the widget view small.
 */

const els = {};
const domIds = [
  'dot', 'loading', 'main', 'planInfo',
  'pct', 'fill', 'usedText', 'totalText',
  'sLeft', 'sToken', 'sBal', 'errBox', 'errText',
];

const DEFAULT_CONFIG = {
  build: 'local-service-2026-05-30',
  serviceUrl: 'http://127.0.0.1:19220/api/credits',
  refreshInterval: 30000,
  requestTimeout: 10000,
};

let config = { ...DEFAULT_CONFIG };

let lastFetchOk = false;
let lastFetchTime = 0;

let fetchController = null;
let isLoading = false;

const intervals = [];

function log(level, message, meta) {
  if (window.widgetAPI && window.widgetAPI.log) {
    window.widgetAPI.log(level, message, meta);
  }
}

function cleanup() {
  log('info', 'cleanup() called');
  intervals.forEach(id => clearInterval(id));
  intervals.length = 0;
  if (fetchController) {
    fetchController.abort();
    fetchController = null;
  }
}

function getNested(obj, path, fallback) {
  return path.reduce(
    (value, key) => (value && value[key] !== undefined ? value[key] : fallback),
    obj
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function fmtShort(value) {
  const n = Math.max(Number(value) || 0, 0);
  if (n >= 1e9) return (n / 1e9).toFixed(n < 10e9 ? 1 : 0) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n < 10e6 ? 1 : 0) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}

function fmtMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '\u00A5' + String(value || 0);
  return '\u00A5' + (amount >= 10 ? amount.toFixed(0) : amount.toFixed(2));
}

function fmtPct(value) {
  const pct = Math.max(Number(value) || 0, 0);
  if (pct < 1) return pct.toFixed(3) + '%';
  if (pct < 10) return pct.toFixed(2) + '%';
  return pct.toFixed(1) + '%';
}

function fmtDate(value) {
  if (!value) return '?';
  const date = String(value).split(' ')[0];
  const parts = date.split('-');
  if (parts.length === 3) return parts[1] + '-' + parts[2] + ' 到期';
  return date || '?';
}

function normalizeCredits(data) {
  const detail = getNested(data, ['detail', 'data'], getNested(data, ['detail'], {}));
  const usage = getNested(
    data,
    ['usage', 'data', 'monthUsage', 'items', 0],
    getNested(data, ['detail', 'usage'], getNested(data, ['usage'], {}))
  );
  const balance = getNested(
    data,
    ['balance', 'data', 'balance'],
    getNested(data, ['detail', 'balance'], getNested(data, ['balance'], 0))
  );

  const used = Math.max(Number(usage.used ?? usage.used_tokens ?? usage.usedToken) || 0, 0);
  const limit = Math.max(Number(usage.limit ?? usage.total ?? usage.total_tokens ?? usage.totalToken) || 0, 0);
  const rawPercent = Number(usage.percent ?? usage.usage_percent ?? usage.percentUsed);

  let percent;
  if (Number.isFinite(rawPercent)) {
    percent = rawPercent <= 1 ? rawPercent * 100 : rawPercent;
  } else {
    percent = limit > 0 ? (used / limit) * 100 : 0;
  }

  const remaining = Math.max(limit - used, 0);

  return {
    planName: detail.planName || detail.plan || detail.name || 'Token Plan',
    expiry: detail.currentPeriodEnd || detail.expire_at || detail.expiry || '',
    used,
    limit,
    percent: clamp(percent, 0, 100),
    remaining,
    tokenEstimate: Math.floor(remaining / 450),
    balance,
  };
}

function validateResponse(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid response');
  if (data.error) throw new Error(String(data.error));

  for (const key of ['detail', 'usage', 'balance']) {
    const section = data[key];
    if (section && typeof section === 'object' && section.code === -1) {
      const reason = String(section.error || section.message || '');
      if (reason.includes('401')) throw new Error('MiMo 登录已失效');
      throw new Error(reason || 'MiMo 数据读取失败');
    }
  }
}

function setViewState(state) {
  els.loading.style.display = state === 'loading' ? 'block' : 'none';
  els.main.style.display = state === 'ready' ? 'block' : 'none';
  els.errBox.style.display = state === 'error' ? 'block' : 'none';
}

function updateDot() {
  if (!lastFetchOk) {
    els.dot.className = 'dot error';
    return;
  }

  const stale = Date.now() - lastFetchTime > config.refreshInterval * 2;
  els.dot.className = stale ? 'dot slow' : 'dot ok';
}

function showError(message) {
  setViewState('error');
  els.errText.textContent = message;
  lastFetchOk = false;
  updateDot();
}

function showCredits(data) {
  const credits = normalizeCredits(data);
  setViewState('ready');

  els.planInfo.textContent = credits.planName + ' · ' + fmtDate(credits.expiry);
  els.pct.textContent = fmtPct(credits.percent);
  els.fill.style.width = Math.max(credits.percent, 0.8) + '%';
  els.fill.className = 'bar-fill' + (credits.percent > 80 ? ' danger' : credits.percent > 50 ? ' warn' : '');

  els.usedText.textContent = fmtShort(credits.used) + ' used';
  els.totalText.textContent = fmtShort(credits.limit) + ' total';
  els.sLeft.textContent = fmtShort(credits.remaining);
  els.sToken.textContent = '~' + fmtShort(credits.tokenEstimate);
  els.sBal.textContent = fmtMoney(credits.balance);

  lastFetchOk = true;
  lastFetchTime = Date.now();
  updateDot();
  log('info', 'showCredits success', { plan: credits.planName, percent: credits.percent });
}

async function fetchCredits(retries = 3) {
  if (isLoading) return;
  isLoading = true;

  log('debug', 'fetchCredits start', { url: config.serviceUrl, retries });

  if (fetchController) {
    fetchController.abort();
  }
  fetchController = new AbortController();
  const timeoutId = setTimeout(() => fetchController.abort(), config.requestTimeout);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(config.serviceUrl, { signal: fetchController.signal });
      if (!response.ok) {
        log('warn', 'HTTP error', { status: response.status, attempt });
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();
      try {
        validateResponse(data);
      } catch (valErr) {
        log('warn', 'validateResponse failed', { error: valErr.message });
        throw valErr;
      }
      showCredits(data);
      clearTimeout(timeoutId);
      fetchController = null;
      isLoading = false;
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        if (attempt < retries - 1 && fetchController?.signal.aborted) {
          clearTimeout(timeoutId);
          isLoading = false;
          return;
        }
        if (attempt === retries - 1) {
          log('warn', 'request timeout', { attempts: retries });
          showError('请求超时');
        }
      } else if (err instanceof TypeError) {
        log('error', 'network error (service not running)', { error: err.message });
        showError('本地服务未启动');
        break;
      } else {
        if (attempt === retries - 1) {
          log('error', 'fetchCredits final failure', { error: err.message });
          showError(err.message || '读取失败');
        }
      }

      if (attempt < retries - 1) {
        log('debug', 'retrying fetchCredits', { attempt: attempt + 1, delay: 1000 * (attempt + 1) });
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  clearTimeout(timeoutId);
  fetchController = null;
  isLoading = false;
}

async function initConfig() {
  try {
    if (window.widgetAPI && window.widgetAPI.getConfig) {
      config = { ...config, ...(await window.widgetAPI.getConfig()) };
      log('info', 'initConfig success', { build: config.build });
    }
  } catch (e) {
    log('warn', 'initConfig failed, using defaults', { error: e.message });
  }
}

async function init() {
  log('info', 'init() called');

  for (const id of domIds) {
    els[id] = document.getElementById(id);
  }

  await initConfig();
  setViewState('loading');

  document.getElementById('btnClose').addEventListener('click', () => {
    cleanup();
    if (window.widgetAPI) window.widgetAPI.close();
  });

  fetchCredits();
  intervals.push(setInterval(fetchCredits, config.refreshInterval));
  intervals.push(setInterval(updateDot, 5000));

  window.addEventListener('beforeunload', cleanup);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
