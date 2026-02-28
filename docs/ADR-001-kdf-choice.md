# ADR-001: Key Derivation Function Choice — Argon2id

**Status:** Accepted  
**Date:** 2026-02-22  
**Deciders:** Security Audit Team

## Context

The vault's master password must be resistant to GPU-based and ASIC-based brute-force attacks. PBKDF2-SHA512 (600k iterations, OWASP 2023) is the current KDF but lacks memory-hardness.

## Decision

**Primary:** Argon2id (64 MB memory, 3 iterations, parallelism 4)  
**Fallback:** PBKDF2-SHA512 (600,000 iterations)

Argon2id is preferred because it is both time-hard and memory-hard, making GPU/ASIC attacks economically infeasible. The fallback exists because Argon2id requires a native Node.js module (`argon2`) that may not compile on all systems.

## Consequences

- **Positive:** 100–1000× cost increase for GPU-based attacks vs PBKDF2-equivalent
- **Positive:** `kdf_version` byte in vault header enables transparent upgrade
- **Negative:** Native module adds build complexity on some platforms
- **Mitigation:** PBKDF2 fallback with OWASP-recommended iterations ensures security floor
