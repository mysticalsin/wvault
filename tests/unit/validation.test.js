/**
 * ============================================================================
 * VALIDATION MODULE UNIT TESTS
 * ============================================================================
 * Tests for: input sanitization, SQL injection prevention, password
 * boundary validation, URL validation, and Unicode edge cases.
 */

const {
    sanitizeFileId,
    validateCredentialId,
    validateUrl,
    sanitizeDomain,
    validatePasswordStrength,
    sanitizeDisplayText,
    validateSearchQuery,
    validateEmail,
    validateHex,
    validatePin,
    isSafeFilePath,
    validateFileSize,
    validateTotpSecret,
    safeJsonParse,
} = require('../../src/main/utils/validation');
const path = require('path');

// ─── Password Validation ─────────────────────────────────────────────────────

describe('validatePasswordStrength', () => {
    it('rejects passwords shorter than 8 characters', () => {
        const result = validatePasswordStrength('Ab1!xyz');
        expect(result.valid).toBe(false);
    });

    it('accepts 8-character password', () => {
        const result = validatePasswordStrength('xk92bmzQ');
        expect(result.valid).toBe(true);
    });

    it('rejects passwords exceeding 1000 characters', () => {
        const result = validatePasswordStrength('A'.repeat(1001));
        expect(result.valid).toBe(false);
        expect(result.error).toContain('1000');
    });

    it('accepts exactly 1000 characters', () => {
        const base = 'x'.repeat(1000);
        const result = validatePasswordStrength(base);
        expect(result.valid).toBe(true);
    });

    it('rejects non-string input', () => {
        expect(validatePasswordStrength(12345).valid).toBe(false);
        expect(validatePasswordStrength(null).valid).toBe(false);
        expect(validatePasswordStrength(undefined).valid).toBe(false);
    });

    it('rejects empty string', () => {
        expect(validatePasswordStrength('').valid).toBe(false);
    });

    it('rejects common weak patterns', () => {
        const result = validatePasswordStrength('password1234');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('weak');
    });
});

// ─── Search Query Validation (SQL Injection Prevention) ──────────────────────

describe('validateSearchQuery', () => {
    it('strips dangerous characters (angle brackets, quotes)', () => {
        const result = validateSearchQuery("test<script>alert('xss')</script>");
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
        expect(result).not.toContain("'");
    });

    it('returns safe string for normal input', () => {
        expect(validateSearchQuery('netflix')).toBe('netflix');
        expect(validateSearchQuery('my bank')).toBe('my bank');
    });

    it('returns null for empty/null input', () => {
        expect(validateSearchQuery('')).toBeNull();
        expect(validateSearchQuery(null)).toBeNull();
    });

    it('rejects queries exceeding 256 characters', () => {
        const longInput = 'a'.repeat(257);
        expect(validateSearchQuery(longInput)).toBeNull();
    });

    it('strips double quotes', () => {
        const result = validateSearchQuery('test"; DROP TABLE credentials; --');
        expect(result).not.toContain('"');
    });
});

// ─── XSS / Display Text Sanitization ────────────────────────────────────────

describe('sanitizeDisplayText', () => {
    it('escapes HTML angle brackets', () => {
        const result = sanitizeDisplayText('<script>alert("xss")</script>');
        expect(result).not.toContain('<script');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
    });

    it('escapes ampersands', () => {
        const result = sanitizeDisplayText('AT&T');
        expect(result).toBe('AT&amp;T');
    });

    it('escapes double and single quotes', () => {
        const result = sanitizeDisplayText('He said "hello" and \'goodbye\'');
        expect(result).toContain('&quot;');
        expect(result).toContain('&#039;');
    });

    it('returns empty string for null/undefined', () => {
        expect(sanitizeDisplayText(null)).toBe('');
        expect(sanitizeDisplayText(undefined)).toBe('');
    });

    it('preserves normal text', () => {
        expect(sanitizeDisplayText('Hello World')).toBe('Hello World');
    });
});

// ─── URL Validation ──────────────────────────────────────────────────────────

describe('validateUrl', () => {
    it('accepts HTTPS URLs', () => {
        expect(validateUrl('https://example.com')).toBe('https://example.com');
    });

    it('accepts HTTP URLs', () => {
        expect(validateUrl('http://example.com')).toBe('http://example.com');
    });

    it('rejects javascript: URIs', () => {
        expect(validateUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejects data: URIs', () => {
        expect(validateUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects file: URIs', () => {
        expect(validateUrl('file:///etc/passwd')).toBeNull();
    });

    it('rejects empty/null', () => {
        expect(validateUrl('')).toBeNull();
        expect(validateUrl(null)).toBeNull();
    });

    it('rejects URLs longer than 2048 chars', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(2048);
        expect(validateUrl(longUrl)).toBeNull();
    });
});

// ─── Domain Sanitization ─────────────────────────────────────────────────────

describe('sanitizeDomain', () => {
    it('lowercases domain', () => {
        expect(sanitizeDomain('Example.COM')).toBe('example.com');
    });

    it('strips protocol prefix', () => {
        expect(sanitizeDomain('https://example.com')).toBe('example.com');
    });

    it('strips path after domain', () => {
        expect(sanitizeDomain('example.com/path/to/page')).toBe('example.com');
    });

    it('strips whitespace', () => {
        expect(sanitizeDomain(' exam ple.com ')).toBe('example.com');
    });

    it('returns empty for null/undefined', () => {
        expect(sanitizeDomain(null)).toBe('');
        expect(sanitizeDomain(undefined)).toBe('');
    });
});

// ─── File ID Validation ──────────────────────────────────────────────────────

describe('sanitizeFileId', () => {
    it('accepts valid UUID format', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        expect(sanitizeFileId(uuid)).toBe(uuid);
    });

    it('rejects path traversal', () => {
        expect(sanitizeFileId('../etc/passwd')).toBeNull();
        expect(sanitizeFileId('..\\Windows\\System32')).toBeNull();
    });

    it('rejects null/empty', () => {
        expect(sanitizeFileId('')).toBeNull();
        expect(sanitizeFileId(null)).toBeNull();
    });

    it('rejects non-UUID strings', () => {
        expect(sanitizeFileId('not-a-uuid')).toBeNull();
    });
});

// ─── Credential ID Validation ────────────────────────────────────────────────

describe('validateCredentialId', () => {
    it('accepts positive integers', () => {
        expect(validateCredentialId(1)).toBe(1);
        expect(validateCredentialId(42)).toBe(42);
    });

    it('rejects zero and negative', () => {
        expect(validateCredentialId(0)).toBeNull();
        expect(validateCredentialId(-1)).toBeNull();
    });

    it('rejects non-numeric input', () => {
        expect(validateCredentialId('abc')).toBeNull();
        expect(validateCredentialId(null)).toBeNull();
    });

    it('parses string integers', () => {
        expect(validateCredentialId('42')).toBe(42);
    });
});

// ─── File Path Safety ────────────────────────────────────────────────────────

describe('isSafeFilePath', () => {
    const basePath = path.resolve('c:/Users/Tony/Desktop/Password Manager/data');

    it('accepts paths within base directory', () => {
        expect(isSafeFilePath(
            path.join(basePath, 'vault.db'),
            basePath
        )).toBe(true);
    });

    it('rejects path traversal above base', () => {
        expect(isSafeFilePath(
            path.join(basePath, '..', '..', 'etc', 'passwd'),
            basePath
        )).toBe(false);
    });

    it('rejects null/empty', () => {
        expect(isSafeFilePath('', basePath)).toBe(false);
        expect(isSafeFilePath(null, basePath)).toBe(false);
    });
});

// ─── File Size Validation ────────────────────────────────────────────────────

describe('validateFileSize', () => {
    it('accepts valid sizes', () => {
        expect(validateFileSize(1024)).toBe(true);
        expect(validateFileSize(1)).toBe(true);
    });

    it('rejects zero and negative', () => {
        expect(validateFileSize(0)).toBe(false);
        expect(validateFileSize(-1)).toBe(false);
    });

    it('rejects non-numeric input', () => {
        expect(validateFileSize('big')).toBe(false);
    });
});

// ─── TOTP Secret Validation ──────────────────────────────────────────────────

describe('validateTotpSecret', () => {
    it('accepts valid base32 strings', () => {
        expect(validateTotpSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    });

    it('rejects non-base32 characters', () => {
        expect(validateTotpSecret('not!base32')).toBe(false);
    });

    it('rejects null/empty', () => {
        expect(validateTotpSecret('')).toBe(false);
        expect(validateTotpSecret(null)).toBe(false);
    });

    it('rejects secrets over 256 characters', () => {
        expect(validateTotpSecret('A'.repeat(257))).toBe(false);
    });
});

// ─── Email Validation ────────────────────────────────────────────────────────

describe('validateEmail', () => {
    it('accepts valid emails', () => {
        expect(validateEmail('test@example.com')).toBe(true);
    });

    it('rejects missing @', () => {
        expect(validateEmail('notanemail')).toBe(false);
    });

    it('rejects null/empty', () => {
        expect(validateEmail('')).toBe(false);
        expect(validateEmail(null)).toBe(false);
    });
});

// ─── Safe JSON Parse ─────────────────────────────────────────────────────────

describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
        expect(safeJsonParse('{"key":"value"}')).toEqual({ key: 'value' });
    });

    it('returns fallback for invalid JSON', () => {
        expect(safeJsonParse('not json', 'default')).toBe('default');
    });

    it('returns fallback for null input', () => {
        expect(safeJsonParse(null, [])).toEqual([]);
    });
});

// ─── Unicode Edge Cases ──────────────────────────────────────────────────────

describe('Unicode edge cases in validation', () => {
    it('handles zero-width joiners (ZWJ) in search', () => {
        const zwj = 'test\u200Dword';
        const result = validateSearchQuery(zwj);
        expect(typeof result).toBe('string');
    });

    it('handles null bytes in search', () => {
        const withNull = 'test\x00word';
        const result = validateSearchQuery(withNull);
        // Should return something, not crash
        expect(result).toBeDefined();
    });

    it('sanitizeDisplayText handles HTML entities in unicode context', () => {
        const result = sanitizeDisplayText('日本語テスト<script>');
        expect(result).toContain('日本語テスト');
        expect(result).toContain('&lt;');
    });
});
