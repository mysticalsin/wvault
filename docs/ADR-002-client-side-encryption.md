# ADR-002: Client-Side Encryption Architecture

**Status:** Accepted  
**Date:** 2026-02-22  
**Deciders:** Security Audit Team

## Context

WVault is a zero-knowledge password manager. The question: where does encryption/decryption happen?

## Decision

All cryptographic operations occur in the **Electron main process**. The renderer process never handles plaintext master passwords or encryption keys.

### Trust Boundary

```
┌────────────────────────────────────┐
│  RENDERER (untrusted zone)         │
│  - React UI, user interaction      │
│  - Receives only encrypted blobs   │
│  - Communicates via contextBridge   │
└──────────────┬─────────────────────┘
               │ IPC (preload.js)
               │ contextBridge only
┌──────────────▼─────────────────────┐
│  MAIN PROCESS (trusted zone)       │
│  - crypto.js: KDF, AES-256-GCM    │
│  - state.encryptionKey: in-memory  │
│  - sql.js: decrypted DB in memory  │
│  - Zeroized on lock/quit           │
└────────────────────────────────────┘
```

## Consequences

- **Positive:** Renderer compromise (XSS) cannot extract keys — `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- **Positive:** CSP `default-src 'self'` blocks all inline scripts and external loads
- **Negative:** All crypto is single-threaded in main, may block UI for large vaults
- **Mitigation:** Vault export/import operations are async with progress feedback
