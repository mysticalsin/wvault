# WVault Browser Extension

Secure password autofill extension that connects to your local WVault desktop application.

## Features

- 🔐 **Secure Connection**: Communicates with local WVault desktop app via encrypted localhost API
- 🔍 **Form Detection**: Automatically detects login forms on websites
- 🚀 **One-Click Autofill**: Quickly fill credentials from your vault
- ⚡ **Password Generator**: Generate strong passwords with one click
- 🛡️ **Privacy First**: Credentials never stored in browser - all data stays in your local vault

## Architecture

```
┌─────────────────┐     HTTP/localhost:9333      ┌──────────────────┐
│  Browser Ext    │  ←────────────────────────→  │  WVault Desktop  │
│  (Content Script)│    Secret Key Auth          │  (Local HTTP API)│
└─────────────────┘                              └──────────────────┘
         ↓
  Detects login forms
         ↓
  Queries desktop app
         ↓
  Displays credentials picker
         ↓
  Fills form on user action
```

## Installation

### From Source (Development)

1. Open Chrome/Edge and navigate to `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The extension icon should appear in your toolbar

### Connecting to WVault Desktop

1. Ensure WVault desktop app is running
2. Click the extension icon
3. Click "Connect to WVault"
4. Approve the connection in your WVault desktop app
5. Start using autofill!

## File Structure

```
extension/
├── manifest.json          # Extension manifest (V3)
├── background/            # Service worker
│   └── service-worker.js  # Background communication hub
├── content_scripts/       # Injected scripts
│   └── form-detector.js   # Login form detection & autofill
├── popup/                 # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/               # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── _locales/             # Internationalization
    └── en/
        └── messages.json
```

## Security

- **No Credential Storage**: Credentials are never stored in browser storage
- **Secret Key Authentication**: Challenge-response authentication with desktop app
- **Session Tokens**: Short-lived session tokens for API communication
- **HTTPS Ready**: Designed to work with HTTPS contexts
- **CORS Restricted**: Desktop API restricts cross-origin requests

## Permissions

- `scripting`: Inject content scripts to detect forms
- `activeTab`: Access current tab for form filling
- `storage`: Store extension settings and session tokens
- `host_permissions`: Access all URLs to detect forms anywhere

## Development

### Building

No build step required - pure vanilla JavaScript.

### Testing

1. Load extension in browser
2. Open WVault desktop app
3. Navigate to a login page
4. Test form detection and autofill

### Debugging

- Background script: `chrome://extensions/` → "service worker" link
- Content script: DevTools → Sources → Content scripts
- Popup: Right-click extension icon → "Inspect popup"

## License

Part of WVault Password Manager
