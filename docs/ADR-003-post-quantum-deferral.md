# ADR-003: Post-Quantum Cryptography Deferral

**Status:** Accepted  
**Date:** 2026-02-22  
**Deciders:** Security Audit Team

## Context

NIST finalized ML-KEM (CRYSTALS-Kyber) and ML-DSA (CRYSTALS-Dilithium) in 2024. Should WVault adopt post-quantum primitives now?

## Decision

**Defer post-quantum migration.** Maintain AES-256-GCM with versioned `cipher_version` byte in vault header to enable future rotation.

## Rationale

1. **AES-256 is already Grover-resistant:** 256-bit symmetric keys require 2^128 operations even under quantum attack — exceeds practical limits
2. **No PQ-KEM needed:** WVault has no key exchange (local-only, no network). The attack vector is brute-forcing the KDF, not intercepting key exchange
3. **Standards stabilizing:** NIST PQC implementations in Node.js are immature; premature adoption risks implementation bugs
4. **Migration path ready:** `cipher_version` byte 0x01 = AES-256-GCM; future 0x02 can map to AES-256-GCM + ML-KEM hybrid

## Consequences

- **Positive:** No risk from immature PQ library bugs
- **Positive:** Vault format already supports algorithm rotation via version header
- **Negative:** If quantum computers arrive earlier than expected, stored vault files could theoretically be attacked (but AES-256 remains safe)
- **Review date:** Re-evaluate when Node.js ships stable NIST PQC bindings
