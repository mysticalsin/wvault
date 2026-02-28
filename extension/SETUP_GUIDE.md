# WVault Browser Extension - Setup Guide

## Overview

The WVault Browser Extension enables secure password autofill by connecting to your local WVault desktop application. All credentials remain encrypted in your local vault - the extension only acts as a bridge.

## Architecture

```
┌──────────────────┐      HTTP/localhost:9333      ┌──────────────────┐
│   Browser Ext    │  ←────────────────────────→   │  WVault Desktop  │
│                  │     Challenge-Response Auth   │   (HTTP Server)  │
│  • Form Detection│                               │                  │
│  • Autofill UI   │                               │  • Encrypted DB  │
│  • Secure Comm   │                               │  • Vault Unlock  │
└──────────────────┘                               └──────────────────┘
```

## Components Created

### 1. Extension Files (`extension/`)
| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (Manifest V3) |
| `background/service-worker.js` | Background communication hub |
| `content_scripts/form-detector.js` | Login form detection & autofill |
| `popup/popup.html/css/js` | Extension popup UI |
| `options/options.html/css/js` | Settings page |
| `_locales/en/messages.json` | i18n support |

### 2. Desktop API (`main.js` additions)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/ping` | Health check |
| `POST /api/auth/challenge` | Get auth challenge |
| `POST /api/auth/verify` | Verify & create session |
| `POST /api/credentials/query` | Query credentials by domain |
| `POST /api/credentials/save` | Save new credential |
| `POST /api/tools/generate-password` | Generate strong password |

## Security Features

- **Challenge-Response Auth**: Extensions must solve a cryptographic challenge
- **Session Tokens**: Short-lived tokens (24hr TTL) for API access
- **No Credential Storage**: Credentials never stored in browser
- **Localhost Only**: API only accessible from localhost
- **User Approval**: Extensions require user approval (can be configured)

## Installation

### 1. Install Extension (Browser)

#### Chrome/Edge:
1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode" (toggle top right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. Extension icon 🔐 should appear in toolbar

#### Firefox (Manifest V2 adaptation needed):
Firefox requires Manifest V2 (service workers not supported).
Adaptation guide would be needed.

### 2. Start WVault Desktop

Ensure your WVault desktop app is running. The extension API server starts automatically on port 9333.

### 3. Connect Extension

1. Click the 🔐 WVault extension icon
2. Click "Connect to WVault"
3. The extension will authenticate with your desktop app

## Usage

### Autofill on Websites

1. Navigate to any login page
2. WVault icon 🔐 appears near username/password fields
3. Click the icon to see matching credentials
4. Select a credential to autofill

### Generate Password

1. Click extension icon
2. Click "Generate Password"
3. Copy or fill the generated password directly

### Popup Actions

- **AutoFill Login**: Fill credentials on current page
- **Generate Password**: Create strong password
- **Settings**: Configure extension behavior
- **Lock**: Clear session and lock extension

## Troubleshooting

### Extension shows "Not Connected"
- Ensure WVault desktop app is running
- Check that port 9333 is not blocked
- Click "Retry Connection"

### Extension shows "Authentication Required"
- Click "Connect to WVault"
- Accept the connection in desktop app (if prompted)

### Forms not detected
- Refresh the page
- Some SPAs may need manual trigger via popup

## Configuration

### Extension Settings

Access via: Extension Icon → ⚙️ Settings

| Setting | Description |
|---------|-------------|
| Auto-detect login forms | Show autofill icon automatically |
| Auto-fill on page load | Fill when only one match exists |
| Show autofill icon | Display icon near login fields |

### Desktop Configuration

The extension API runs on `localhost:9333`. To change:

1. Edit `EXTENSION_PORT` in `main.js`
2. Update `WVAULT_HOST` in `extension/background/service-worker.js`
3. Reload both extension and desktop app

## File Structure

```
Password Manager/
├── extension/              # Browser extension
│   ├── manifest.json       # Extension manifest
│   ├── background/         # Service worker
│   │   └── service-worker.js
│   ├── content_scripts/    # Page injection
│   │   └── form-detector.js
│   ├── popup/              # Extension UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/            # Settings page
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── icons/              # Extension icons
│   └── _locales/           # i18n
├── main.js                 # Desktop app (with Extension API)
└── ...
```

## API Reference

### Authentication Flow

```
1. Extension → POST /api/auth/challenge
   ← { challenge, salt }

2. Extension computes: SHA256(challenge + salt + extensionId)

3. Extension → POST /api/auth/verify
   { extensionId, solution, challenge }
   ← { token }

4. Extension uses token in X-WVault-Token header for all requests
```

### Session Management

- Sessions expire after 24 hours
- Maximum 5 concurrent sessions
- Sessions are cleared when vault is locked

## Future Enhancements

- [ ] Firefox support (Manifest V2)
- [ ] Safari extension
- [ ] Biometric unlock integration
- [ ] Auto-save new credentials
- [ ] Password strength indicator
- [ ] 2FA/TOTP autofill

## License

Part of WVault Password Manager
