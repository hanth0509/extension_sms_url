/**
 * popup/popup.js
 * Main controller for the ShieldScan popup UI
 * Manages tabs, SMS scanner, URL scanner, and settings
 */

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  TabController.init();
  SMSScanner.init();
  URLScanner.init();
  SettingsPanel.init();
  OfflineMonitor.init();
  HeaderActions.init();

  // Set version
  const manifest = chrome.runtime.getManifest();
  const vEl = document.getElementById('ext-version');
  if (vEl) vEl.textContent = `v${manifest.version}`;
});

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
const Toast = (() => {
  const container = () => document.getElementById('toast-container');

  function show(message, type = 'info', duration = 3000) {
    const icons = {
      success: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      info:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${Helpers.escapeHtml(message)}</span>`;
    container().appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  return { show, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
})();

/* ============================================================
   TAB CONTROLLER
   ============================================================ */
const TabController = (() => {
  function init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach(p => {
      const isActive = p.id === `tab-${tabId}`;
      p.classList.toggle('active', isActive);
      p.classList.toggle('hidden', !isActive);
    });
  }

  return { init, switchTab };
})();

/* ============================================================
   HEADER ACTIONS
   ============================================================ */
const HeaderActions = (() => {
  function init() {
    document.getElementById('btn-dashboard')?.addEventListener('click', openDashboard);
    document.getElementById('btn-settings')?.addEventListener('click', () => TabController.switchTab('settings'));
  }

  function openDashboard() {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  }

  return { init };
})();

/* ============================================================
   OFFLINE MONITOR
   ============================================================ */
const OfflineMonitor = (() => {
  function init() {
    update();
    window.addEventListener('online',  update);
    window.addEventListener('offline', update);
  }

  function update() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
      banner.classList.toggle('hidden', navigator.onLine);
    }
  }

  return { init };
})();

/* ============================================================
   SHARED: LOADING STATE FOR BUTTONS
   ============================================================ */
function setButtonLoading(btn, isLoading) {
  const textEl   = btn.querySelector('.btn-text');
  const spinnerEl = btn.querySelector('.btn-spinner');
  btn.disabled = isLoading;
  if (textEl)    textEl.classList.toggle('hidden', isLoading);
  if (spinnerEl) spinnerEl.classList.toggle('hidden', !isLoading);
}

/* ============================================================
   SHARED: COPY RESULT BUTTON
   ============================================================ */
async function handleCopyResult(btn, text) {
  const ok = await Helpers.copyToClipboard(text);
  if (ok) {
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    Toast.success('Result copied to clipboard');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Result`;
    }, 2000);
  } else {
    Toast.error('Failed to copy to clipboard');
  }
}

/* ============================================================
   SMS SCANNER
   ============================================================ */
const SMSScanner = (() => {
  let lastResult = null;

  function init() {
    const textarea = document.getElementById('sms-input');
    const analyzeBtn = document.getElementById('sms-analyze-btn');
    const clearBtn   = document.getElementById('sms-clear-btn');
    const charCount  = document.getElementById('sms-char-count');

    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        analyzeBtn.click();
      }
    });

    analyzeBtn.addEventListener('click', () => analyze());
    clearBtn.addEventListener('click', () => clearAll());
  }

  async function analyze() {
    const textarea   = document.getElementById('sms-input');
    const analyzeBtn = document.getElementById('sms-analyze-btn');
    const resultEl   = document.getElementById('sms-result');
    const message    = textarea.value;

    if (!Helpers.isOnline()) {
      Toast.error('No internet connection. Please check your network.');
      return;
    }

    setButtonLoading(analyzeBtn, true);
    resultEl.classList.add('hidden');

    try {
      const data = await SpamDetectorAPI.analyzeSMS(message);
      lastResult = data;
      renderSMSResult(data);
    } catch (err) {
      Toast.error(err.message || 'Analysis failed. Please try again.');
    } finally {
      setButtonLoading(analyzeBtn, false);
    }
  }

  function renderSMSResult(data) {
    const resultEl = document.getElementById('sms-result');
    const prob     = data.spam_probability ?? 0;
    const severity = Helpers.getSeverity(prob);
    const label    = data.label || (prob >= 0.5 ? 'spam' : 'ham');
    const probPct  = Helpers.formatProbability(prob);
    const ts       = Helpers.formatTimestamp(data.created_at);

    // Copy text
    const copyText = [
      `ShieldScan SMS Analysis`,
      `Label: ${label.toUpperCase()}`,
      `Spam Probability: ${probPct}`,
      `Severity: ${severity.label}`,
      `Recommendation: ${severity.recommendation}`,
      `Timestamp: ${ts}`,
      `Message: ${data.message || ''}`,
    ].join('\n');

    resultEl.innerHTML = `
      <div class="result-header severity-${severity.level}">
        <div class="result-badge">
          <span class="badge-dot" style="background:${severity.color}; box-shadow:0 0 6px ${severity.color}"></span>
          <span class="badge-label" style="color:${severity.color}">${Helpers.escapeHtml(label.toUpperCase())}</span>
          <span class="badge-sublabel">SMS</span>
        </div>
        <span class="badge-label" style="color:${severity.color}">${severity.label}</span>
      </div>
      <div class="result-body">
        <div class="result-row">
          <span class="result-key">Confidence</span>
          <div class="prob-bar-wrap" style="flex:1; justify-content:flex-end;">
            <div class="prob-bar" style="max-width:120px;">
              <div class="prob-bar-fill" style="width:${prob*100}%; background:${severity.color};"></div>
            </div>
            <span class="prob-val" style="color:${severity.color}">${probPct}</span>
          </div>
        </div>
        <div class="result-row">
          <span class="result-key">Severity</span>
          <span class="result-val" style="color:${severity.color}; font-weight:600;">${severity.label}</span>
        </div>
        <div class="result-divider"></div>
        <div class="recommendation-box">${Helpers.escapeHtml(severity.recommendation)}</div>
      </div>
      <div class="result-footer">
        <span class="result-timestamp">${ts}</span>
        <button class="btn-copy" id="sms-copy-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy Result
        </button>
      </div>
    `;

    resultEl.classList.remove('hidden');

    document.getElementById('sms-copy-btn')?.addEventListener('click', function () {
      handleCopyResult(this, copyText);
    });
  }

  function clearAll() {
    const textarea  = document.getElementById('sms-input');
    const resultEl  = document.getElementById('sms-result');
    const charCount = document.getElementById('sms-char-count');
    textarea.value  = '';
    charCount.textContent = '0';
    resultEl.classList.add('hidden');
    resultEl.innerHTML = '';
    lastResult = null;
    textarea.focus();
  }

  return { init };
})();

/* ============================================================
   URL SCANNER
   ============================================================ */
const URLScanner = (() => {
  let lastResult = null;

  function init() {
    const input      = document.getElementById('url-input');
    const analyzeBtn = document.getElementById('url-analyze-btn');
    const clearBtn   = document.getElementById('url-clear-btn');
    const pasteBtn   = document.getElementById('url-paste-btn');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') analyzeBtn.click();
    });

    analyzeBtn.addEventListener('click', () => analyze());
    clearBtn.addEventListener('click',   () => clearAll());
    pasteBtn?.addEventListener('click',  () => pasteCurrentTabURL());
  }

  async function pasteCurrentTabURL() {
    chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, (res) => {
      if (res?.url) {
        document.getElementById('url-input').value = res.url;
        Toast.info('Current tab URL loaded');
      }
    });
  }

  async function analyze() {
    const input      = document.getElementById('url-input');
    const analyzeBtn = document.getElementById('url-analyze-btn');
    const resultEl   = document.getElementById('url-result');
    const url        = input.value;

    if (!Helpers.isOnline()) {
      Toast.error('No internet connection. Please check your network.');
      return;
    }

    setButtonLoading(analyzeBtn, true);
    resultEl.classList.add('hidden');

    try {
      const data = await SpamDetectorAPI.analyzeURL(url);
      lastResult = data;
      renderURLResult(data);
    } catch (err) {
      Toast.error(err.message || 'Analysis failed. Please try again.');
    } finally {
      setButtonLoading(analyzeBtn, false);
    }
  }

  function renderURLResult(data) {
    const resultEl  = document.getElementById('url-result');
    const prob      = data.phishing_probability ?? 0;
    const riskLevel = data.risk_level || (prob >= 0.5 ? 'High' : 'Low');
    const label     = data.label || (prob >= 0.5 ? 'phishing' : 'safe');
    const riskColor = Helpers.getRiskColor(riskLevel);
    const probPct   = Helpers.formatProbability(prob);
    const ts        = Helpers.formatTimestamp(data.created_at);

    const sslStatus  = data.ssl_certificate === true ? '✓ Valid' : data.ssl_certificate === false ? '✗ Invalid / None' : '—';
    const sslColor   = data.ssl_certificate === true ? 'var(--green)' : data.ssl_certificate === false ? 'var(--red)' : 'var(--text-muted)';

    const indicators = Array.isArray(data.suspicious_indicators) ? data.suspicious_indicators : [];
    const indicatorsHTML = indicators.length > 0
      ? `<div class="indicators-list">${indicators.map(i => `<span class="indicator-tag">${Helpers.escapeHtml(i)}</span>`).join('')}</div>`
      : `<span class="indicators-empty">None detected</span>`;

    const copyText = [
      `ShieldScan URL Analysis`,
      `URL: ${data.url || ''}`,
      `Label: ${label.toUpperCase()}`,
      `Phishing Probability: ${probPct}`,
      `Risk Level: ${riskLevel}`,
      `Domain: ${data.domain || ''}`,
      `SSL: ${sslStatus}`,
      `Registration Date: ${data.registration_date || '—'}`,
      `Reputation: ${data.reputation || '—'}`,
      `Suspicious Indicators: ${indicators.join(', ') || 'None'}`,
      `Timestamp: ${ts}`,
    ].join('\n');

    resultEl.innerHTML = `
      <div class="result-header" style="background:${riskColor}1a; border-bottom:1px solid ${riskColor}33">
        <div class="result-badge">
          <span class="badge-dot" style="background:${riskColor}; box-shadow:0 0 6px ${riskColor}"></span>
          <span class="badge-label" style="color:${riskColor}">${Helpers.escapeHtml(label.toUpperCase())}</span>
          <span class="badge-sublabel">URL</span>
        </div>
        <span class="badge-label" style="color:${riskColor}">${Helpers.escapeHtml(riskLevel)} Risk</span>
      </div>
      <div class="result-body">
        <div class="result-row">
          <span class="result-key">Phishing Prob.</span>
          <div class="prob-bar-wrap" style="flex:1; justify-content:flex-end;">
            <div class="prob-bar" style="max-width:120px;">
              <div class="prob-bar-fill" style="width:${prob*100}%; background:${riskColor};"></div>
            </div>
            <span class="prob-val" style="color:${riskColor}">${probPct}</span>
          </div>
        </div>
        <div class="result-divider"></div>
        <div class="result-row">
          <span class="result-key">Domain</span>
          <span class="result-val highlight">${Helpers.escapeHtml(data.domain || '—')}</span>
        </div>
        <div class="result-row">
          <span class="result-key">SSL</span>
          <span class="result-val" style="color:${sslColor}">${sslStatus}</span>
        </div>
        <div class="result-row">
          <span class="result-key">Registered</span>
          <span class="result-val">${Helpers.escapeHtml(data.registration_date || '—')}</span>
        </div>
        <div class="result-row">
          <span class="result-key">Reputation</span>
          <span class="result-val">${Helpers.escapeHtml(data.reputation || '—')}</span>
        </div>
        <div class="result-row">
          <span class="result-key">Risk Level</span>
          <span class="result-val" style="color:${riskColor}; font-weight:600;">${Helpers.escapeHtml(riskLevel)}</span>
        </div>
        <div class="result-divider"></div>
        <div class="result-row" style="align-items:flex-start;">
          <span class="result-key" style="padding-top:3px;">Indicators</span>
          ${indicatorsHTML}
        </div>
      </div>
      <div class="result-footer">
        <span class="result-timestamp">${ts}</span>
        <button class="btn-copy" id="url-copy-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy Result
        </button>
      </div>
    `;

    resultEl.classList.remove('hidden');

    document.getElementById('url-copy-btn')?.addEventListener('click', function () {
      handleCopyResult(this, copyText);
    });
  }

  function clearAll() {
    const input    = document.getElementById('url-input');
    const resultEl = document.getElementById('url-result');
    input.value    = '';
    resultEl.classList.add('hidden');
    resultEl.innerHTML = '';
    lastResult = null;
    input.focus();
  }

  return { init };
})();

/* ============================================================
   SETTINGS PANEL
   ============================================================ */
const SettingsPanel = (() => {
  const DEFAULTS = {
    backendUrl:   'http://127.0.0.1:8000',
    dashboardUrl: 'http://localhost:3000',
  };

  function init() {
    loadSettings();
    checkBackendStatus();

    document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
    document.getElementById('reset-settings-btn')?.addEventListener('click', resetSettings);
    document.getElementById('open-dashboard-btn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    });
  }

  function loadSettings() {
    chrome.storage.sync.get(DEFAULTS, (data) => {
      document.getElementById('backend-url-input').value   = data.backendUrl;
      document.getElementById('dashboard-url-input').value = data.dashboardUrl;
    });
  }

  function saveSettings() {
    const backendUrl   = document.getElementById('backend-url-input').value.trim();
    const dashboardUrl = document.getElementById('dashboard-url-input').value.trim();
    const btn          = document.getElementById('save-settings-btn');

    if (!backendUrl) {
      Toast.error('Backend URL cannot be empty.');
      return;
    }
    try { new URL(backendUrl); } catch {
      Toast.error('Backend URL is not valid.');
      return;
    }

    btn.disabled = true;
    chrome.storage.sync.set({ backendUrl, dashboardUrl }, () => {
      Toast.success('Settings saved successfully!');
      btn.disabled = false;
      checkBackendStatus();
    });
  }

  function resetSettings() {
    document.getElementById('backend-url-input').value   = DEFAULTS.backendUrl;
    document.getElementById('dashboard-url-input').value = DEFAULTS.dashboardUrl;
    chrome.storage.sync.set(DEFAULTS, () => {
      Toast.success('Settings reset to default.');
      checkBackendStatus();
    });
  }

  async function checkBackendStatus() {
    const statusEl = document.getElementById('backend-status');
    if (!statusEl) return;

    statusEl.innerHTML = `<span class="status-dot"></span> Checking...`;

    const stored = await chrome.storage.sync.get({ backendUrl: DEFAULTS.backendUrl });
    const url    = stored.backendUrl.replace(/\/$/, '');

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/api/v1/predict-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'ping' }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      // Any HTTP response means server is reachable
      statusEl.innerHTML = `<span class="status-dot online"></span> Online`;
    } catch {
      statusEl.innerHTML = `<span class="status-dot offline"></span> Unreachable`;
    }
  }

  return { init };
})();
