# WVault Architecture

## System Overview

WVault is a zero-knowledge, offline-first desktop password manager built on Electron. All cryptographic operations occur in the main process; the renderer never handles sensitive data.

## Key Hierarchy

```
Master Password (user input)
    │
    ├─ NFKC normalize → password.normalize('NFKC')
    │
    ▼
┌─────────────────────────────────┐
│  KDF (Argon2id or PBKDF2-SHA512) │
│  Salt: 32 random bytes (per vault)│
│  Output: 256-bit master key       │
└──────────────┬──────────────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 Vault Key  Folder Keys   Attachment Keys
 (AES-256   (PBKDF2-SHA256 (HMAC-SHA256
  -GCM)      per folder,    derived per
              unique salt)   file ID)
```

## Vault File Format (v2)

```
Byte offset   Field              Size
──────────────────────────────────────
0             CIPHER_VERSION     1 byte   (0x01 = AES-256-GCM)
1             KDF_VERSION        1 byte   (0x01 = PBKDF2, 0x02 = Argon2id)
2-33          SALT               32 bytes
34-45         IV                 12 bytes
46-61         AUTH_TAG            16 bytes
62+           ENCRYPTED_DATA     variable
```

Legacy vaults (pre-v2) have no 2-byte header; detected by examining first two bytes.

## Trust Boundaries

```
┌──────────────────────────────────────────┐
│  RENDERER (React, untrusted)             │
│  contextIsolation: true                  │
│  nodeIntegration: false                  │
│  sandbox: true                           │
│  CSP: default-src 'self'; script-src     │
│       'self'; object-src 'none'          │
└──────────────┬───────────────────────────┘
               │ contextBridge (preload.js)
               │ 74 explicitly whitelisted IPC methods
┌──────────────▼───────────────────────────┐
│  MAIN PROCESS (Node.js, trusted)         │
│  - crypto.js: all KDF + AES operations   │
│  - state.encryptionKey: Buffer (zeroized │
│    on lock via randomFillSync + fill(0)) │
│  - sql.js: in-memory SQLite database     │
│  - IPC validated with Zod .strict()      │
│  - Audit log with anomaly detection      │
└──────────────────────────────────────────┘
```

## Security Invariants

| Invariant | Enforcement |
|-----------|-------------|
| Encryption key never in renderer | contextBridge + contextIsolation |
| No eval() or inline scripts | CSP `script-src 'self'` |
| No external resource loads | CSP `default-src 'self'` (except favicon service) |
| IPC inputs validated | Zod schemas with `.strict()` |
| Key zeroized on lock | `crypto.randomFillSync()` + `fill(0)` |
| Clipboard cleared | 30s auto-clear + clear on quit |
| ID generation is CSPRNG | `crypto.randomBytes(8)` replaces Math.random |
| Brute-force protected | 5 attempts → 15-minute lockout |
| Copy anomaly detected | >5 copies in 60s → RAPID_COPY_SEQUENCE audit |
