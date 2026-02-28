/**
 * WVault Browser Extension - Background Service Worker
 * Handles secure communication between browser and desktop WVault app
 */

const WVAULT_HOST = 'http://localhost:9333';
const EXTENSION_VERSION = '1.0.0';

// Secure storage for session
let sessionToken = null;
let isConnected = false;

// Generate or retrieve extension ID for pairing
async function getExtensionId() {
  let id = await chrome.storage.local.get('wvault_ext_id');
  if (!id.wvault_ext_id) {
    id = crypto.randomUUID();
    await chrome.storage.local.set({ wvault_ext_id: id });
  }
  return id.wvault_ext_id;
}

// Secure hash for challenge-response
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Check if WVault desktop is running
async function checkDesktopConnection() {
  try {
    const response = await fetch(`${WVAULT_HOST}/api/ping`, {
      method: 'GET',
      headers: { 'X-WVault-Extension': EXTENSION_VERSION }
    });
    isConnected = response.ok;
    return isConnected;
  } catch (e) {
    isConnected = false;
    return false;
  }
}

// Authenticate with desktop app using challenge-response
async function authenticateWithDesktop() {
  try {
    const extId = await getExtensionId();
    
    // Step 1: Get challenge from desktop
    const challengeRes = await fetch(`${WVAULT_HOST}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionId: extId })
    });
    
    if (!challengeRes.ok) throw new Error('Failed to get challenge');
    const { challenge, salt } = await challengeRes.json();
    
    // Step 2: Solve challenge (desktop verifies this)
    const solution = await sha256(challenge + salt + extId);
    
    // Step 3: Send solution
    const authRes = await fetch(`${WVAULT_HOST}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extensionId: extId,
        solution: solution,
        challenge: challenge
      })
    });
    
    if (authRes.ok) {
      const { token } = await authRes.json();
      sessionToken = token;
      await chrome.storage.local.set({ wvault_token: token });
      return true;
    }
    return false;
  } catch (e) {
    console.error('Auth error:', e);
    return false;
  }
}

// Secure API call to desktop
async function callDesktopAPI(endpoint, data = {}) {
  if (!sessionToken) {
    const stored = await chrome.storage.local.get('wvault_token');
    sessionToken = stored.wvault_token;
  }
  
  if (!sessionToken) {
    const authed = await authenticateWithDesktop();
    if (!authed) throw new Error('Not authenticated');
  }
  
  const response = await fetch(`${WVAULT_HOST}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WVault-Token': sessionToken,
      'X-WVault-Extension': EXTENSION_VERSION
    },
    body: JSON.stringify(data)
  });
  
  if (response.status === 401) {
    // Token expired, re-authenticate
    sessionToken = null;
    await chrome.storage.local.remove('wvault_token');
    return callDesktopAPI(endpoint, data);
  }
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}

// Query credentials for a domain
async function queryCredentials(domain) {
  try {
    return await callDesktopAPI('/api/credentials/query', { domain });
  } catch (e) {
    console.error('Query failed:', e);
    return { success: false, credentials: [] };
  }
}

// Save new credential
async function saveCredential(data) {
  try {
    return await callDesktopAPI('/api/credentials/save', data);
  } catch (e) {
    console.error('Save failed:', e);
    return { success: false };
  }
}

// Message handling from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      case 'checkConnection':
        sendResponse({ 
          connected: await checkDesktopConnection(),
          authenticated: !!sessionToken
        });
        break;
        
      case 'authenticate':
        sendResponse({ success: await authenticateWithDesktop() });
        break;
        
      case 'queryCredentials':
        sendResponse(await queryCredentials(request.domain));
        break;
        
      case 'saveCredential':
        sendResponse(await saveCredential(request.data));
        break;
        
      case 'generatePassword':
        try {
          const result = await callDesktopAPI('/api/tools/generate-password', {
            length: request.length || 20
          });
          sendResponse(result);
        } catch (e) {
          sendResponse({ success: false });
        }
        break;
        
      case 'lock':
        sessionToken = null;
        await chrome.storage.local.remove('wvault_token');
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true; // Async response
});

// Auto-trigger auth check on startup
chrome.runtime.onStartup.addListener(async () => {
  await checkDesktopConnection();
});

chrome.runtime.onInstalled.addListener(async () => {
  await checkDesktopConnection();
});

// Handle tab updates for potential form filling
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Notify content script to scan for forms
    chrome.tabs.sendMessage(tabId, { action: 'scanForms' }).catch(() => {});
  }
});
