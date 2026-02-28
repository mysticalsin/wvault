# WVault Operational Runbooks

## Runbook 1: Master Password Rotation

**When:** User wants to change their master password, or periodic rotation.

### Steps
1. Unlock vault with current master password
2. Go to Settings → Security → Change Master Password
3. Enter current password for verification
4. Enter new password (minimum 8 chars, recommended 20+ or passphrase)
5. Vault is re-encrypted with a new random salt + new KDF-derived key
6. Old vault backup (`.backup`) is automatically created during save
7. Verify unlock with new password
8. Delete `.backup` file after confirming successful unlock

### Recovery
- If new password forgotten immediately: restore `.wvault.backup` → `.wvault`
- If backup doesn't exist: vault is irrecoverable (zero-knowledge design)

---

## Runbook 2: Suspected Vault File Compromise

**When:** Device stolen, file copied by unauthorized party, or suspicious access.

### Assessment
1. WVault uses AES-256-GCM with authenticated encryption — attacker cannot:
   - Read any data without the master password
   - Modify data without detection (auth tag verification will fail)
   - Determine vault contents or size beyond file length

2. Attacker CAN attempt offline brute-force against the KDF:
   - PBKDF2-SHA512 (600k iterations): ~1 attempt/sec on consumer GPU
   - Argon2id (64 MB): ~0.1 attempt/sec on consumer GPU
   - Strong passphrase (5+ words): effectively unbreakable

### Response
1. **Immediately:** Change all credentials stored in the vault (prioritize banking, email)
2. **Change master password** on the non-compromised device
3. **Review audit log** for any RAPID_COPY_SEQUENCE or unusual activity
4. **Re-encrypt vault** with a stronger passphrase if previous password was weak
5. Consider enabling biometric authentication to reduce password entry frequency

---

## Runbook 3: Backup and Restore

### Creating Backups
1. Vault file is at: `%APPDATA%\wvault\vault.wvault`
2. Copy this file to secure backup location
3. Attachment files are in: `%APPDATA%\wvault\attachments\`
4. Backup the entire `%APPDATA%\wvault\` directory

### Restoring from Backup
1. Close WVault completely (check system tray)
2. Copy backup `.wvault` file to `%APPDATA%\wvault\vault.wvault`
3. Copy backup `attachments/` directory if present
4. Launch WVault and unlock with the master password that was active at backup time

### Important Notes
- Backup files are encrypted — safe to store on cloud services
- Master password is NOT stored anywhere — it cannot be recovered
- Settings and audit log are stored inside the encrypted vault
- USB/external drive backups should be encrypted at the drive level

---

## Runbook 4: Application Security Audit

### Quick Security Check
```powershell
# 1. Run dependency audit
npm audit --audit-level=moderate

# 2. Run unit tests
npx vitest run

# 3. Build and check for warnings
npm run build

# 4. Verify Electron security settings
# Check main.js for: contextIsolation: true, nodeIntegration: false, sandbox: true

# 5. Verify CSP headers
# Check index.html for: default-src 'self'; script-src 'self'; object-src 'none'
```

### What to Look For
- Any `npm audit` findings above `moderate` severity
- Test failures in crypto or validation suites
- `Math.random()` usage in src/ (should be zero — all replaced with crypto.randomBytes)
- Missing `contextIsolation` or `sandbox` in window creation
- CSP allowing `unsafe-eval` or `unsafe-inline` for scripts
