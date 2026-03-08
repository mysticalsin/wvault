/**
 * WVault Constants
 * Centralized configuration for security, limits, and UI
 */

// Security Constants
const SECURITY = {
    PBKDF2_ITERATIONS: 600000,
    PBKDF2_KEYLEN: 32,
    PBKDF2_DIGEST: 'sha512',
    PIN_ITERATIONS: 100000,
    AES_ALGORITHM: 'aes-256-gcm',
    IV_LENGTH: 12,
    SALT_LENGTH: 32,
    AUTH_TAG_LENGTH: 16,
    MAX_PASSWORD_LENGTH: 1000,      // Supports passphrases (WCAG / i18n)
    MIN_PASSWORD_LENGTH: 8,
    MAX_PIN_ATTEMPTS: 5,
    PIN_LOCKOUT_MS: 5 * 60 * 1000,   // 5 minutes
    AUTO_LOCK_MS: 5 * 60 * 1000,     // 5 minutes
    BRUTE_FORCE_THRESHOLD: 5,         // 5 attempts before lockout
    BRUTE_FORCE_WINDOW: 15 * 60 * 1000, // 15 minutes
    BRUTE_FORCE_LOCKOUT: 15 * 60 * 1000, // 15 minutes (was 30s)
};

// Input Validation Limits
const LIMITS = {
    MAX_STRING_LENGTH: 10000,
    MAX_ID_VALUE: 2147483647,
    MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
    MAX_IMPORT_COUNT: 10000,
    MAX_ATTACHMENT_SIZE: 500 * 1024 * 1024,
    MAX_CSV_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_SEARCH_RESULTS: 100,
    ITEMS_PER_PAGE: 50,
    MAX_AUDIT_LOG_SIZE: 1000,
    CACHE_TTL_MS: 5000,
};

// UI Constants
const UI = {
    ANIMATION_DURATION: 200,
    TOAST_DURATION: 3000,
    DEBOUNCE_MS: 300,
    PASSWORD_VISIBILITY_TIMEOUT: 30000,
    CLIPBOARD_CLEAR_DELAY: 30000,
};

// Allowed Protocols for URL validation
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// UUID Regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Default section settings
const DEFAULT_SECTION_SETTINGS = {
    generator: true,
    audit: true,
    trash: true,
    settings: true,
    games: true,
    notes: true,
    cards: true
};

// Aurora Glassmorphism accent definitions
const THEMES = [
    { id: 'orchid', name: 'Orchid', color: '201 103 232', hex: '#C967E8', accent: 'purple' },
    { id: 'bloom', name: 'Pink Bloom', color: '250 147 250', hex: '#FA93FA', accent: 'fuchsia' },
    { id: 'violet', name: 'Deep Violet', color: '152 58 214', hex: '#983AD6', accent: 'violet' },
    { id: 'rose', name: 'Rose', color: '244 63 94', hex: '#f43f5e', accent: 'rose' },
    { id: 'emerald', name: 'Emerald', color: '16 185 129', hex: '#10b981', accent: 'emerald' },
    { id: 'amber', name: 'Amber', color: '245 158 11', hex: '#f59e0b', accent: 'amber' },
];

// Common password patterns to reject
const COMMON_PATTERNS = [
    'password', '123456', 'qwerty', 'admin', 'letmein', 'welcome',
    'monkey', 'dragon', 'master', 'shadow', 'sunshine', 'princess',
    'football', 'baseball', 'iloveyou', 'trustno1', 'abc123', 'welcome123'
];

// SQL Keywords to prevent injection
const SQL_KEYWORDS = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE',
    'ALTER', 'EXEC', 'EXECUTE', 'UNION', 'SCRIPT'
];

// Export all constants
module.exports = {
    SECURITY,
    LIMITS,
    UI,
    ALLOWED_PROTOCOLS,
    UUID_REGEX,
    DEFAULT_SECTION_SETTINGS,
    THEMES,
    COMMON_PATTERNS,
    SQL_KEYWORDS
};
