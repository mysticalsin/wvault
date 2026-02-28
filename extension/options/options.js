/**
 * WVault Options Page
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('href').slice(1);
      
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      sections.forEach(s => s.classList.add('hidden'));
      document.getElementById(target).classList.remove('hidden');
    });
  });
  
  // Load settings
  const settings = await chrome.storage.local.get([
    'wvault_auto_detect',
    'wvault_auto_fill',
    'wvault_show_icon',
    'wvault_ext_id'
  ]);
  
  // Apply settings
  document.getElementById('auto-detect').checked = settings.wvault_auto_detect !== false;
  document.getElementById('auto-fill').checked = settings.wvault_auto_fill === true;
  document.getElementById('show-icon').checked = settings.wvault_show_icon !== false;
  
  // Show extension ID
  const extId = settings.wvault_ext_id || 'Not generated yet';
  document.getElementById('ext-id').textContent = extId;
  
  // Save settings on change
  const toggles = ['auto-detect', 'auto-fill', 'show-icon'];
  toggles.forEach(id => {
    document.getElementById(id).addEventListener('change', async (e) => {
      const key = 'wvault_' + id.replace(/-/g, '_');
      await chrome.storage.local.set({ [key]: e.target.checked });
    });
  });
  
  // Clear session
  document.getElementById('clear-session').addEventListener('click', async () => {
    if (confirm('Clear session? You will need to re-authenticate with WVault desktop app.')) {
      await chrome.storage.local.remove('wvault_token');
      alert('Session cleared. The extension is now locked.');
    }
  });
});
