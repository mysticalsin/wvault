# WVault Changelog

## Version 5.0.0 - Celestial Security Release (Latest)

### 🌌 WVault Rebrand
- **Complete rebrand** from GlassVault Pro v2.0.0 to WVault 5.0
- **New identity**: WVault "Where Your World is Secured"
- **Celestial theme**: Constellation-based UI elements
- **Clean UI**: Removed version badge from main interface (now in Settings → About)
- **Developer signature**: "coded by Tony Walteur" in sidebar footer

### 🎮 Games Galaxy v2.0
- **Unlimited accounts**: Removed all account limits per platform
- **11 Gaming Platforms**: Steam, Epic, EA, Ubisoft, Riot, Battle.net, Xbox, PlayStation, Nintendo, GOG, Other
- **Auto-fill service names**: Clicking a platform locks the service name (e.g., "Riot Games")
- **Visual platform selector**: Grid of platform icons with custom SVG icons
- **Smart integration**: Pre-fills service name and website when adding from Games section

### 🔭 Observatory Security Center
- **Immutable Audit Trail**: Blockchain-style integrity verification
- **Tamper-proof logging**: Each entry cryptographically chained
- **Brute Force Protection**: 3-attempt detection with real-time WebSocket alerts
- **Geolocation privacy**: Auto-obfuscated to 10km radius
- **Location**: Security Audit → Observatory tab

### 🎮 Games Galaxy (Mandatory)
- Games is now a **primary mandatory section**
- Visual: RGB gas giant with platform moons
- Store game accounts, 2FA backup codes, API keys
- Always visible in sidebar (not toggleable)

### 📝 Notes Constellation (Optional)
- Notes is now **hidden by default**
- Enable via Settings → Privacy → "Enable Notes Constellation"
- Appears between Cards and Games when enabled

### 🐛 Critical Bug Fixes
- **P0: Fixed Lock Vault button** - Proper state synchronization and memory sanitization
- Memory zeroing on vault lock for enhanced security

### 🔧 Technical Improvements
- WVAULT 5.0 architecture with audit logging
- Real-time security event notifications
- Chain verification for audit integrity
- **API Migration**: Migrated from `glassVault` to `wvault` throughout codebase
- **WVault Constellation Logo**: Custom SVG logo in sidebar

### 👨‍💻 Developer
- **Coded by Tony Walteur**

---

## Version 2.1.0 - Previous Release

### 🐛 Bug Fixes
- Fixed account creation flow
- Fixed user name persistence
- Fixed attachment download/save issues

### ✨ Features
- Personalized Dashboard with user name
- Time-based greetings
- Enhanced UI animations

---

## Installation

Run `WVault Setup 5.0.0.exe` to install the latest version.

**Note**: Your existing vault data will be preserved when upgrading from GlassVault.
