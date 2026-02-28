/**
 * WVault Extension Popup
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusEl = document.getElementById('status');
  const notConnectedEl = document.getElementById('not-connected');
  const notAuthenticatedEl = document.getElementById('not-authenticated');
  const connectedEl = document.getElementById('connected');
  const siteNameEl = document.getElementById('site-name');
  const siteCredsEl = document.getElementById('site-creds');
  const credentialsListEl = document.getElementById('credentials-list');
  
  let currentTab = null;
  let currentDomain = '';
  let credentials = [];
  
  // Get current tab
  async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }
  
  // Extract domain from URL
  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }
  
  // Show specific state
  function showState(state) {
    notConnectedEl.classList.add('hidden');
    notAuthenticatedEl.classList.add('hidden');
    connectedEl.classList.add('hidden');
    
    if (state === 'connected') {
      connectedEl.classList.remove('hidden');
      statusEl.textContent = '● Connected';
      statusEl.className = 'status connected';
    } else if (state === 'not-authenticated') {
      notAuthenticatedEl.classList.remove('hidden');
      statusEl.textContent = '● Not Authenticated';
      statusEl.className = 'status error';
    } else {
      notConnectedEl.classList.remove('hidden');
      statusEl.textContent = '● Disconnected';
      statusEl.className = 'status error';
    }
  }
  
  // Check connection status
  async function checkStatus() {
    const response = await chrome.runtime.sendMessage({ action: 'checkConnection' });
    
    if (!response.connected) {
      showState('not-connected');
      return;
    }
    
    if (!response.authenticated) {
      showState('not-authenticated');
      return;
    }
    
    showState('connected');
    await loadCredentials();
  }
  
  // Load credentials for current site
  async function loadCredentials() {
    if (!currentDomain) return;
    
    siteNameEl.textContent = currentDomain;
    
    const response = await chrome.runtime.sendMessage({
      action: 'queryCredentials',
      domain: currentDomain
    });
    
    credentials = response.credentials || [];
    
    siteCredsEl.textContent = `${credentials.length} credential${credentials.length !== 1 ? 's' : ''} saved`;
    
    // Render credentials list
    credentialsListEl.innerHTML = '';
    
    if (credentials.length === 0) {
      credentialsListEl.innerHTML = `
        <div style="text-align:center;padding:20px;color:#64748b;">
          <p>No credentials for this site</p>
        </div>
      `;
      return;
    }
    
    credentials.forEach((cred, index) => {
      const item = document.createElement('div');
      item.className = 'credential-item';
      item.innerHTML = `
        <div class="cred-icon">🔑</div>
        <div class="cred-info">
          <div class="cred-title">${escapeHtml(cred.service || cred.username)}</div>
          <div class="cred-username">${escapeHtml(cred.username)}</div>
        </div>
        <div class="cred-action">→</div>
      `;
      item.onclick = () => fillCredentials(index);
      credentialsListEl.appendChild(item);
    });
  }
  
  // Fill credentials on page
  async function fillCredentials(index) {
    const cred = credentials[index];
    
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'fillForm',
      credential: cred
    });
    
    window.close();
  }
  
  // Escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Generate password
  async function generatePassword() {
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span>⏳</span> Generating...';
    
    const response = await chrome.runtime.sendMessage({
      action: 'generatePassword',
      length: 20
    });
    
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span>⚡</span> Generate Password';
    
    if (response.success && response.password) {
      // Show generated password
      credentialsListEl.innerHTML = `
        <div style="text-align:center;">
          <p style="color:#94a3b8;margin-bottom:12px;">Strong password generated</p>
          <div class="password-result" style="position:relative;">
            ${escapeHtml(response.password)}
            <button class="copy-btn" id="copy-pass">Copy</button>
          </div>
          <button class="btn-primary btn-full" id="fill-generated" style="margin-top:12px;">
            Fill in Page
          </button>
        </div>
      `;
      
      document.getElementById('copy-pass').onclick = () => {
        navigator.clipboard.writeText(response.password);
        const btn = document.getElementById('copy-pass');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 1500);
      };
      
      document.getElementById('fill-generated').onclick = async () => {
        await chrome.tabs.sendMessage(currentTab.id, {
          action: 'fillPassword',
          password: response.password
        });
        window.close();
      };
    }
  }
  
  // Event listeners
  document.getElementById('retry-btn').onclick = checkStatus;
  
  document.getElementById('auth-btn').onclick = async () => {
    const btn = document.getElementById('auth-btn');
    btn.disabled = true;
    btn.textContent = 'Connecting...';
    
    const response = await chrome.runtime.sendMessage({ action: 'authenticate' });
    
    if (response.success) {
      showState('connected');
      await loadCredentials();
    } else {
      btn.disabled = false;
      btn.textContent = 'Connect to WVault';
      alert('Connection failed. Please ensure WVault desktop app is running and try again.');
    }
  };
  
  document.getElementById('fill-btn').onclick = async () => {
    if (credentials.length > 0) {
      await fillCredentials(0);
    }
  };
  
  document.getElementById('generate-btn').onclick = generatePassword;
  
  document.getElementById('lock-btn').onclick = async () => {
    await chrome.runtime.sendMessage({ action: 'lock' });
    showState('not-authenticated');
  };
  
  document.getElementById('settings-btn').onclick = () => {
    chrome.runtime.openOptionsPage?.() || 
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  };
  
  // Initialize
  currentTab = await getCurrentTab();
  currentDomain = getDomain(currentTab?.url);
  await checkStatus();
});
