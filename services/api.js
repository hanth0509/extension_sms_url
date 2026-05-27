/**
 * services/api.js
 * API communication layer for Spam & Phishing Detector
 * Handles all HTTP requests to the FastAPI backend with retry logic
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';
const API_PREFIX = '/api/v1';
const MAX_RETRIES = 1;
const TIMEOUT_MS = 15000;

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Core request function with retry logic
 */
async function apiRequest(endpoint, payload, retries = MAX_RETRIES) {
  // Get base URL from storage
  const stored = await chrome.storage.sync.get({ backendUrl: DEFAULT_BASE_URL });
  const baseUrl = stored.backendUrl.replace(/\/$/, '');
  const url = `${baseUrl}${API_PREFIX}${endpoint}`;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new ApiError(
          errorBody.detail || `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (err) {
      const isLastAttempt = attempt === retries;

      // Don't retry on client errors (4xx) or abort
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out. Please try again.', 408);
      }

      if (isLastAttempt) {
        if (err instanceof ApiError) throw err;
        // Network error
        if (!navigator.onLine) {
          throw new ApiError('No internet connection detected.', 0);
        }
        throw new ApiError(
          `Cannot connect to backend. Is the server running at ${baseUrl}?`,
          0
        );
      }

      // Wait briefly before retry
      await new Promise(r => setTimeout(r, 600));
    }
  }
}

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Analyze SMS message for spam
 * @param {string} message - SMS content to analyze
 * @returns {Promise<Object>} API response
 */
async function analyzeSMS(message) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new ApiError('Message content cannot be empty.', 400);
  }
  if (message.trim().length < 3) {
    throw new ApiError('Message is too short to analyze.', 400);
  }
  return apiRequest('/predict-sms', { message: message.trim() });
}

/**
 * Analyze URL for phishing
 * @param {string} url - URL to analyze
 * @returns {Promise<Object>} API response
 */
async function analyzeURL(url) {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new ApiError('URL cannot be empty.', 400);
  }

  const trimmed = url.trim();

  // Basic URL validation
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ApiError('Only HTTP and HTTPS URLs are supported.', 400);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Please enter a valid URL.', 400);
  }

  return apiRequest('/predict-url', { url: trimmed });
}

// Export for use in popup and background
window.SpamDetectorAPI = { analyzeSMS, analyzeURL, ApiError };
