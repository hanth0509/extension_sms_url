/**
 * utils/helpers.js
 * Shared utility functions for Spam & Phishing Detector
 */

/**
 * Map spam_probability to severity level
 * @param {number} probability - 0 to 1
 * @returns {{ level: string, label: string, color: string }}
 */
function getSeverity(probability) {
  if (probability >= 0.8) {
    return {
      level: 'critical',
      label: 'Critical',
      color: '#ff3b5c',
      recommendation: 'Do not click any links or reply.',
    };
  } else if (probability >= 0.6) {
    return {
      level: 'high',
      label: 'High',
      color: '#ff8c42',
      recommendation: 'Verify sender before taking action.',
    };
  } else if (probability >= 0.4) {
    return {
      level: 'medium',
      label: 'Medium',
      color: '#ffd166',
      recommendation: 'Proceed cautiously.',
    };
  } else {
    return {
      level: 'safe',
      label: 'Safe',
      color: '#06d6a0',
      recommendation: 'No obvious malicious indicators.',
    };
  }
}

/**
 * Map risk_level string to color
 */
function getRiskColor(riskLevel) {
  const map = {
    critical: '#ff3b5c',
    high: '#ff8c42',
    medium: '#ffd166',
    low: '#06d6a0',
    safe: '#06d6a0',
  };
  return map[(riskLevel || '').toLowerCase()] || '#94a3b8';
}

/**
 * Format a probability (0–1) as a percentage string
 */
function formatProbability(prob) {
  return `${(prob * 100).toFixed(2)}%`;
}

/**
 * Format ISO date string to readable local format
 */
function formatTimestamp(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Copy text to clipboard and return success bool
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older environments
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Escape HTML to prevent XSS when inserting user/API data
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if browser is online
 */
function isOnline() {
  return navigator.onLine;
}

/**
 * Truncate a string for display
 */
function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length <= maxLen ? str : str.slice(0, maxLen - 3) + '...';
}

// Export
window.Helpers = {
  getSeverity,
  getRiskColor,
  formatProbability,
  formatTimestamp,
  copyToClipboard,
  escapeHtml,
  isOnline,
  truncate,
};
