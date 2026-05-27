/**
 * options/options.js
 * Settings page controller (full tab version)
 */

const DEFAULTS = {
  backendUrl: 'http://127.0.0.1:8000',
  dashboardUrl: 'http://localhost:3000',
};

function showToast(message, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.className = `toast-bar ${type} show`;
  setTimeout(() => { t.className = 'toast-bar'; }, 2800);
}

document.addEventListener('DOMContentLoaded', () => {
  const backendInput   = document.getElementById('backend-url');
  const dashboardInput = document.getElementById('dashboard-url');
  const saveBtn        = document.getElementById('save-btn');
  const resetBtn       = document.getElementById('reset-btn');

  // Load current settings
  chrome.storage.sync.get(DEFAULTS, (data) => {
    backendInput.value   = data.backendUrl;
    dashboardInput.value = data.dashboardUrl;
  });

  saveBtn.addEventListener('click', () => {
    const backendUrl   = backendInput.value.trim();
    const dashboardUrl = dashboardInput.value.trim();

    if (!backendUrl) { showToast('Backend URL cannot be empty.', 'error'); return; }
    try { new URL(backendUrl); } catch { showToast('Backend URL is invalid.', 'error'); return; }

    chrome.storage.sync.set({ backendUrl, dashboardUrl }, () => {
      showToast('Settings saved successfully!', 'success');
    });
  });

  resetBtn.addEventListener('click', () => {
    backendInput.value   = DEFAULTS.backendUrl;
    dashboardInput.value = DEFAULTS.dashboardUrl;
    chrome.storage.sync.set(DEFAULTS, () => {
      showToast('Settings reset to default.', 'success');
    });
  });
});
