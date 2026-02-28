/**
 * WVault Content Script
 * Detects login forms and provides autofill functionality
 */

(function() {
  'use strict';
  
  // Prevent double-injection
  if (window.__wvault_injected) return;
  window.__wvault_injected = true;
  
  let currentDomain = window.location.hostname;
  let detectedForms = [];
  let wvaultOverlay = null;
  
  // Field detection patterns
  const USERNAME_PATTERNS = [
    'username', 'user', 'email', 'login', 'id', 'account', 
    'userid', 'user-id', 'user_id', 'login-id', 'login_id',
    'auth-user', 'auth_user', 'name', 'identifier'
  ];
  
  const PASSWORD_PATTERNS = [
    'password', 'pass', 'pwd', 'passwd', 'userpassword',
    'login-password', 'current-password', 'new-password'
  ];
  
  // Check if field matches patterns
  function matchesPattern(element, patterns) {
    const attrs = [
      element.type,
      element.name,
      element.id,
      element.placeholder,
      element.getAttribute('autocomplete'),
      element.className
    ].map(a => (a || '').toLowerCase());
    
    return patterns.some(pattern => 
      attrs.some(attr => attr.includes(pattern))
    );
  }
  
  // Score field likelihood (0-100)
  function scoreUsernameField(input) {
    let score = 0;
    const type = input.type.toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    
    if (type === 'email') score += 40;
    if (type === 'text') score += 20;
    if (autocomplete.includes('username')) score += 50;
    if (autocomplete.includes('email')) score += 45;
    if (USERNAME_PATTERNS.some(p => name.includes(p))) score += 30;
    if (USERNAME_PATTERNS.some(p => id.includes(p))) score += 25;
    if (input.placeholder?.toLowerCase().includes('user')) score += 15;
    
    return score;
  }
  
  function scorePasswordField(input) {
    let score = 0;
    const type = input.type.toLowerCase();
    const name = (input.name || '').toLowerCase();
    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    
    if (type === 'password') score += 60;
    if (autocomplete.includes('current-password')) score += 50;
    if (autocomplete.includes('new-password')) score += 40;
    if (PASSWORD_PATTERNS.some(p => name.includes(p))) score += 30;
    
    return score;
  }
  
  // Find login forms on the page
  function findLoginForms() {
    const forms = [];
    const allInputs = document.querySelectorAll('input');
    
    // Group inputs by form or proximity
    const processedInputs = new Set();
    
    allInputs.forEach(input => {
      if (processedInputs.has(input)) return;
      
      const userScore = scoreUsernameField(input);
      const passScore = scorePasswordField(input);
      
      if (userScore > 30 || passScore > 30) {
        // Look for paired fields
        const form = input.closest('form');
        let usernameField = null;
        let passwordField = null;
        let submitButton = null;
        
        if (form) {
          const formInputs = form.querySelectorAll('input');
          formInputs.forEach(fi => {
            if (scoreUsernameField(fi) > 30 && !usernameField) {
              usernameField = fi;
            }
            if (scorePasswordField(fi) > 30 && !passwordField) {
              passwordField = fi;
            }
            processedInputs.add(fi);
          });
          
          submitButton = form.querySelector('button[type="submit"], input[type="submit"]') ||
                        form.querySelector('button');
        } else {
          // No form element, check nearby inputs
          if (userScore > 30) usernameField = input;
          if (passScore > 30) passwordField = input;
          
          // Look for nearby password field
          if (usernameField && !passwordField) {
            const parent = usernameField.parentElement;
            if (parent) {
              const siblings = parent.querySelectorAll('input[type="password"]');
              if (siblings.length > 0) passwordField = siblings[0];
            }
          }
        }
        
        if ((usernameField || passwordField)) {
          forms.push({
            usernameField,
            passwordField,
            submitButton,
            form,
            id: crypto.randomUUID()
          });
        }
      }
    });
    
    return forms;
  }
  
  // Create autofill overlay/icon
  function createAutofillIcon(form) {
    const icon = document.createElement('div');
    icon.className = 'wvault-autofill-icon';
    icon.innerHTML = '🔐';
    icon.title = 'WVault AutoFill Available';
    icon.style.cssText = `
      position: absolute;
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999999;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
      transition: transform 0.2s;
    `;
    
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCredentialPicker(form);
    });
    
    // Position near username field or password field
    const target = form.usernameField || form.passwordField;
    if (target) {
      const rect = target.getBoundingClientRect();
      icon.style.top = `${rect.top + window.scrollY}px`;
      icon.style.left = `${rect.right + window.scrollX + 8}px`;
      document.body.appendChild(icon);
    }
    
    return icon;
  }
  
  // Show credential picker popup
  async function showCredentialPicker(form) {
    // Remove existing overlay
    if (wvaultOverlay) wvaultOverlay.remove();
    
    // Query credentials from background
    const response = await chrome.runtime.sendMessage({
      action: 'queryCredentials',
      domain: currentDomain
    });
    
    const credentials = response?.credentials || [];
    
    const overlay = document.createElement('div');
    overlay.className = 'wvault-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    const popup = document.createElement('div');
    popup.style.cssText = `
      background: #1a1a2e;
      border-radius: 16px;
      padding: 24px;
      min-width: 320px;
      max-width: 400px;
      color: white;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    
    if (credentials.length === 0) {
      popup.innerHTML = `
        <h3 style="margin:0 0 16px 0;font-size:18px;">🔐 WVault</h3>
        <p style="margin:0 0 16px 0;color:#94a3b8;">No credentials found for ${currentDomain}</p>
        <button id="wvault-generate" style="
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
        ">Generate Strong Password</button>
        <button id="wvault-close" style="
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
          margin-top: 8px;
        ">Close</button>
      `;
      
      popup.querySelector('#wvault-close').onclick = () => overlay.remove();
      popup.querySelector('#wvault-generate').onclick = async () => {
        const gen = await chrome.runtime.sendMessage({
          action: 'generatePassword',
          length: 20
        });
        if (gen.success && form.passwordField) {
          form.passwordField.value = gen.password;
          form.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
          overlay.remove();
        }
      };
    } else {
      let credsHTML = `
        <h3 style="margin:0 0 16px 0;font-size:18px;">🔐 WVault Credentials</h3>
        <p style="margin:0 0 16px 0;color:#94a3b8;font-size:14px;">${currentDomain}</p>
        <div style="max-height: 300px; overflow-y: auto;">
      `;
      
      credentials.forEach((cred, i) => {
        credsHTML += `
          <div class="wvault-cred" data-index="${i}" style="
            padding: 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
          " onmouseover="this.style.background='rgba(99,102,241,0.2)';this.style.borderColor='rgba(99,102,241,0.5)'" 
             onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='transparent'">
            <div style="font-weight:600;font-size:14px;">${escapeHtml(cred.service || cred.username)}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${escapeHtml(cred.username)}</div>
          </div>
        `;
      });
      
      credsHTML += `
        </div>
        <button id="wvault-close" style="
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 12px;
          width: 100%;
        ">Cancel</button>
      `;
      
      popup.innerHTML = credsHTML;
      
      popup.querySelectorAll('.wvault-cred').forEach(el => {
        el.onclick = () => {
          const cred = credentials[parseInt(el.dataset.index)];
          fillForm(form, cred);
          overlay.remove();
        };
      });
      
      popup.querySelector('#wvault-close').onclick = () => overlay.remove();
    }
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    wvaultOverlay = overlay;
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
  
  // Fill form with credentials
  function fillForm(form, cred) {
    if (form.usernameField && cred.username) {
      form.usernameField.value = cred.username;
      form.usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      form.usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    if (form.passwordField && cred.password) {
      form.passwordField.value = cred.password;
      form.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      form.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  
  // Escape HTML for safety
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Main detection loop
  function scanAndEnhanceForms() {
    // Remove old icons
    document.querySelectorAll('.wvault-autofill-icon').forEach(el => el.remove());
    
    const forms = findLoginForms();
    detectedForms = forms;
    
    forms.forEach(form => {
      createAutofillIcon(form);
    });
  }
  
  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanForms') {
      scanAndEnhanceForms();
      sendResponse({ success: true });
    }
    if (request.action === 'fillForm') {
      // Find first form and fill with credential
      if (detectedForms.length > 0 && request.credential) {
        fillForm(detectedForms[0], request.credential);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No form found' });
      }
    }
    if (request.action === 'fillPassword') {
      // Fill password in first detected password field
      if (detectedForms.length > 0 && request.password) {
        const form = detectedForms[0];
        if (form.passwordField) {
          form.passwordField.value = request.password;
          form.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
          form.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No password field found' });
      }
    }
    return true;
  });
  
  // Watch for DOM changes (SPAs)
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element
            if (node.tagName === 'INPUT' || node.querySelector?.('input')) {
              shouldScan = true;
            }
          }
        });
      }
    });
    
    if (shouldScan) {
      setTimeout(scanAndEnhanceForms, 100);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Initial scan
  scanAndEnhanceForms();
  
  // Re-scan on URL change (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      currentDomain = window.location.hostname;
      setTimeout(scanAndEnhanceForms, 500);
    }
  }).observe(document, { subtree: true, childList: true });
  
})();
