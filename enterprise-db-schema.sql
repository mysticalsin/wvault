-- ============================================================================
-- GLASSVAULT ENTERPRISE DATABASE SCHEMA EXTENSIONS
-- ============================================================================
-- Run this SQL to upgrade existing databases to Enterprise v3.0
-- ============================================================================

-- ============================================================================
-- ENTERPRISE USER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS enterprise_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    external_id TEXT, -- SSO/IdP identifier
    role TEXT NOT NULL DEFAULT 'contributor',
    department TEXT,
    manager_id INTEGER,
    is_active INTEGER DEFAULT 1,
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret TEXT,
    hardware_key_registered INTEGER DEFAULT 0,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (manager_id) REFERENCES enterprise_users(id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    geo_country TEXT,
    geo_city TEXT,
    mfa_verified INTEGER DEFAULT 0,
    biometric_verified INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id)
);

-- ============================================================================
-- RBAC TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'read_only',
    granted_by INTEGER,
    granted_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    UNIQUE(vault_id, user_id),
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id),
    FOREIGN KEY (granted_by) REFERENCES enterprise_users(id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL, -- JSON array
    mfa_required INTEGER DEFAULT 0,
    hardware_key_required INTEGER DEFAULT 0,
    max_session_minutes INTEGER DEFAULT 120,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Initialize default roles
INSERT OR IGNORE INTO role_permissions (role, permissions, mfa_required, hardware_key_required, max_session_minutes) VALUES
('super_admin', '["*"]', 1, 1, 15),
('admin', '["vault:create","vault:delete","vault:manage","user:manage","audit:view","credential:*"]', 1, 0, 30),
('manager', '["credential:read","credential:write","credential:share","vault:read"]', 1, 0, 60),
('contributor', '["credential:read","credential:write","vault:read"]', 0, 0, 120),
('read_only', '["credential:read","vault:read"]', 0, 0, 60);

-- ============================================================================
-- SECURITY AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, -- UUID
    timestamp TEXT DEFAULT (datetime('now')),
    severity TEXT NOT NULL, -- 'info', 'warning', 'high', 'critical'
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_user_id INTEGER,
    actor_session_id TEXT,
    resource_type TEXT,
    resource_id TEXT,
    vault_id TEXT,
    outcome TEXT NOT NULL, -- 'success', 'failure', 'blocked', 'warning'
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    geo_country TEXT,
    geo_city TEXT,
    geo_latitude REAL,
    geo_longitude REAL,
    mfa_used INTEGER DEFAULT 0,
    biometric_score REAL,
    details TEXT, -- JSON
    integrity_hash TEXT, -- Tamper detection
    FOREIGN KEY (actor_user_id) REFERENCES enterprise_users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_log(severity);

-- ============================================================================
-- BRUTE FORCE PROTECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS failed_auth_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    attempted_username TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    geo_country TEXT,
    geo_city TEXT,
    failure_reason TEXT,
    keystroke_dynamics TEXT, -- JSON
    mouse_dynamics TEXT, -- JSON
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id)
);

CREATE INDEX IF NOT EXISTS idx_failed_auth_user ON failed_auth_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_failed_auth_ip ON failed_auth_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_auth_time ON failed_auth_attempts(timestamp);

CREATE TABLE IF NOT EXISTS account_lockouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    locked_at TEXT DEFAULT (datetime('now')),
    unlock_at TEXT,
    reason TEXT NOT NULL,
    triggered_by_attempts INTEGER,
    source_ips TEXT, -- JSON array
    requires_admin_unlock INTEGER DEFAULT 0,
    unlocked_by INTEGER,
    unlocked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id),
    FOREIGN KEY (unlocked_by) REFERENCES enterprise_users(id)
);

-- ============================================================================
-- HONEY-POT CREDENTIALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS honeypot_credentials (
    id TEXT PRIMARY KEY, -- UUID
    credential_id TEXT NOT NULL UNIQUE, -- References credentials table
    decoy_type TEXT NOT NULL, -- 'admin_account', 'service_account', 'executive_account'
    service_name TEXT NOT NULL,
    is_triggered INTEGER DEFAULT 0,
    trigger_count INTEGER DEFAULT 0,
    first_triggered_at TEXT,
    last_triggered_at TEXT,
    triggered_by_sessions TEXT, -- JSON array of session IDs
    auto_lockdown_triggered INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS honeypot_triggers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    honeypot_id TEXT NOT NULL,
    triggered_at TEXT DEFAULT (datetime('now')),
    session_id TEXT NOT NULL,
    user_id INTEGER,
    action TEXT NOT NULL, -- 'view', 'copy', 'edit'
    ip_address TEXT,
    geo_location TEXT, -- JSON
    screenshot_path TEXT,
    session_recording_path TEXT,
    FOREIGN KEY (honeypot_id) REFERENCES honeypot_credentials(id),
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id)
);

-- ============================================================================
-- BIOMETRIC PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS biometric_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    typing_baseline TEXT, -- JSON: { avg_dwell, avg_flight, wpm, error_rate }
    mouse_baseline TEXT, -- JSON: { avg_velocity, jitter_ratio }
    sample_count INTEGER DEFAULT 0,
    confidence_score REAL DEFAULT 0,
    last_trained_at TEXT,
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id)
);

CREATE TABLE IF NOT EXISTS biometric_sessions (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    keystrokes TEXT, -- JSON array
    mouse_movements TEXT, -- JSON array
    analyzed_at TEXT,
    confidence_score REAL,
    requires_mfa INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id)
);

-- ============================================================================
-- GEO-FENCING POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id TEXT NOT NULL UNIQUE,
    policy_type TEXT DEFAULT 'allow', -- 'allow', 'deny', 'restrictive'
    allowed_countries TEXT, -- JSON array
    blocked_countries TEXT, -- JSON array
    allowed_networks TEXT, -- JSON array of CIDR
    require_vpn INTEGER DEFAULT 0,
    vpn_endpoint TEXT,
    gps_boundary TEXT, -- JSON: { lat, lng, radius }
    time_restrictions TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS geo_access_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    vault_id TEXT NOT NULL,
    attempted_at TEXT DEFAULT (datetime('now')),
    ip_address TEXT,
    geo_country TEXT,
    geo_city TEXT,
    violation_type TEXT, -- 'country', 'network', 'gps', 'time'
    details TEXT, -- JSON
    blocked INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES enterprise_users(id)
);

-- ============================================================================
-- ENTERPRISE SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS enterprise_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Default enterprise configuration
INSERT OR REPLACE INTO enterprise_settings (key, value) VALUES
('enterprise.enabled', 'true'),
('enterprise.version', '3.0.0'),
('rbac.enabled', 'true'),
('audit.enabled', 'true'),
('brute_force.enabled', 'true'),
('brute_force.max_attempts', '5'),
('brute_force.lockout_minutes', '30'),
('honeypot.enabled', 'true'),
('honeypot.decoy_count', '3'),
('biometrics.enabled', 'true'),
('biometrics.confidence_threshold', '0.85'),
('geofencing.enabled', 'true'),
('siem.enabled', 'false'),
('siem.endpoint', ''),
('siem.format', 'json');

-- ============================================================================
-- SECURITY POLICY CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_name TEXT NOT NULL UNIQUE,
    policy_type TEXT NOT NULL, -- 'password', 'session', 'mfa', 'network'
    configuration TEXT NOT NULL, -- JSON
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Password Policy
INSERT OR REPLACE INTO security_policies (policy_name, policy_type, configuration) VALUES
('default_password_policy', 'password', '{
    "min_length": 12,
    "max_length": 128,
    "require_uppercase": true,
    "require_lowercase": true,
    "require_numbers": true,
    "require_special": true,
    "prevent_common": true,
    "expiration_days": 90,
    "history_count": 12,
    "max_age_days": 90
}');

-- Session Policy
INSERT OR REPLACE INTO security_policies (policy_name, policy_type, configuration) VALUES
('default_session_policy', 'session', '{
    "absolute_timeout": 480,
    "idle_timeout": 30,
    "concurrent_sessions": 3,
    "require_reauth_for_sensitive": true,
    "enforce_ip_binding": false
}');

-- MFA Policy
INSERT OR REPLACE INTO security_policies (policy_name, policy_type, configuration) VALUES
('default_mfa_policy', 'mfa', '{
    "required_for_roles": ["super_admin", "admin", "manager"],
    "methods": ["totp", "hardware_key"],
    "grace_period_days": 7,
    "remember_device_days": 30
}');

-- ============================================================================
-- MIGRATION: UPDATE EXISTING CREDENTIALS TABLE
-- ============================================================================

-- Add enterprise columns if not exists
ALTER TABLE credentials ADD COLUMN owner_id INTEGER REFERENCES enterprise_users(id);
ALTER TABLE credentials ADD COLUMN last_accessed_at TEXT;
ALTER TABLE credentials ADD COLUMN last_accessed_by INTEGER REFERENCES enterprise_users(id);
ALTER TABLE credentials ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE credentials ADD COLUMN is_shared INTEGER DEFAULT 0;
ALTER TABLE credentials ADD COLUMN share_expires_at TEXT;

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_security_summary AS
SELECT
    date(timestamp) as date,
    count(*) as total_events,
    sum(case when severity = 'critical' then 1 else 0 end) as critical_count,
    sum(case when severity = 'high' then 1 else 0 end) as high_count,
    sum(case when category = 'access_control' then 1 else 0 end) as access_events,
    sum(case when outcome = 'blocked' then 1 else 0 end) as blocked_attempts
FROM audit_log
GROUP BY date(timestamp);

CREATE VIEW IF NOT EXISTS v_user_access_summary AS
SELECT
    u.id,
    u.username,
    u.role,
    count(distinct s.id) as session_count,
    max(s.started_at) as last_login,
    count(distinct l.id) as failed_attempts_24h
FROM enterprise_users u
LEFT JOIN user_sessions s ON u.id = s.user_id AND s.started_at >= datetime('now', '-24 hours')
LEFT JOIN failed_auth_attempts l ON u.id = l.user_id AND l.timestamp >= datetime('now', '-24 hours')
WHERE u.is_active = 1
GROUP BY u.id;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_enterprise_users_timestamp
AFTER UPDATE ON enterprise_users
BEGIN
    UPDATE enterprise_users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS log_credential_access
AFTER UPDATE ON credentials
WHEN OLD.access_count != NEW.access_count
BEGIN
    INSERT INTO audit_log (
        id, timestamp, severity, category, action, 
        actor_user_id, resource_id, outcome, details
    ) VALUES (
        lower(hex(randomblob(16))),
        datetime('now'),
        'info',
        'access_control',
        'credential_viewed',
        NEW.last_accessed_by,
        NEW.id,
        'success',
        json_object('access_count', NEW.access_count)
    );
END;
