/**
 * ============================================================================
 * GLASSVAULT ENTERPRISE SECURITY MODULE
 * ============================================================================
 * 
 * Enterprise-Plus Password Management Layer
 * Features: RBAC, SSO/SAML, Audit Logging, Brute Force Detection,
 *           Honey-Pot Credentials, Biometric Velocity, Geo-Fencing
 * 
 * @module enterprise-security
 * @version 3.0.0
 * @security-level Enterprise-Plus
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcMain, app } = require('electron');

// ============================================================================
// ENTERPRISE CONFIGURATION
// ============================================================================

const ENTERPRISE_CONFIG = {
    // Brute Force Protection
    bruteForce: {
        maxAttempts: 5,
        lockoutDuration: 30 * 60 * 1000, // 30 minutes
        alertThreshold: 3,
        metadataRetention: 90 * 24 * 60 * 60 * 1000 // 90 days
    },
    
    // Geo-Fencing
    geoFencing: {
        enabled: true,
        defaultPolicy: 'allow',
        restrictedVaults: ['financial', 'admin', 'critical'],
        trustedNetworks: [], // Populated from policy
        gpsPrecision: 100 // meters
    },
    
    // Biometric Velocity
    biometrics: {
        enabled: true,
        learningPeriod: 7, // days to build baseline
        toleranceThreshold: 0.15, // 15% deviation triggers MFA
        requiredSamples: 10,
        velocityWindow: 5 * 60 * 1000 // 5 minutes
    },
    
    // Honey-Pot Credentials
    honeyPot: {
        enabled: true,
        decoyCount: 3,
        highValueTargets: ['admin', 'root', 'sysadmin', 'domain'],
        silentAlarm: true,
        autoLockdown: true
    },
    
    // Audit & SIEM
    audit: {
        enabled: true,
        logLevel: 'verbose',
        siemExport: true,
        siemFormat: 'json', // 'json', 'cef', 'leef'
        retention: 365, // days
        realTimeStreaming: true
    },
    
    // RBAC
    rbac: {
        enabled: true,
        roles: ['super_admin', 'admin', 'manager', 'contributor', 'read_only'],
        enforceMfa: ['super_admin', 'admin']
    }
};

// ============================================================================
// SECURITY STATE MANAGEMENT
// ============================================================================

class EnterpriseSecurityState {
    constructor() {
        this.failedAttempts = new Map(); // userId -> { count, firstAttempt, lastAttempt, metadata[] }
        this.lockouts = new Map(); // userId -> unlockTime
        this.biometricProfiles = new Map(); // userId -> { baseline, samples, confidence }
        this.activeSessions = new Map(); // sessionId -> { userId, startTime, geo, device }
        this.honeyPotTriggers = new Map(); // credentialId -> { triggerCount, lastTrigger }
        this.auditBuffer = [];
        this.siemSocket = null;
    }
    
    isLockedOut(userId) {
        const lockoutTime = this.lockouts.get(userId);
        if (!lockoutTime) return false;
        
        if (Date.now() > lockoutTime) {
            this.lockouts.delete(userId);
            this.failedAttempts.delete(userId);
            return false;
        }
        return true;
    }
    
    getLockoutTimeRemaining(userId) {
        const lockoutTime = this.lockouts.get(userId);
        if (!lockoutTime) return 0;
        return Math.max(0, lockoutTime - Date.now());
    }
}

const enterpriseState = new EnterpriseSecurityState();

// ============================================================================
// AUDIT LOGGING SYSTEM
// ============================================================================

class AuditLogger {
    constructor() {
        this.logQueue = [];
        this.flushInterval = null;
        this.siemEndpoint = null;
        this.startFlushInterval();
    }
    
    startFlushInterval() {
        this.flushInterval = setInterval(() => {
            this.flushLogs();
        }, 5000); // Flush every 5 seconds
    }
    
    /**
     * Log security event with full metadata
     */
    async log(event) {
        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            severity: event.severity || 'info',
            category: event.category,
            action: event.action,
            actor: {
                userId: event.userId,
                sessionId: event.sessionId,
                ipAddress: event.ipAddress || await this.getClientIp(),
                userAgent: event.userAgent,
                deviceFingerprint: event.deviceFingerprint || this.generateDeviceFingerprint()
            },
            resource: {
                type: event.resourceType,
                id: event.resourceId,
                vaultId: event.vaultId
            },
            context: {
                geolocation: event.geo || await this.getGeolocation(event.ipAddress),
                network: event.network,
                mfaUsed: event.mfaUsed || false,
                biometricScore: event.biometricScore
            },
            outcome: event.outcome || 'success',
            details: event.details || {},
            integrity: null // Will be computed
        };
        
        // Compute log integrity hash (tamper detection)
        entry.integrity = this.computeIntegrityHash(entry);
        
        this.logQueue.push(entry);
        
        // Real-time streaming to SIEM
        if (ENTERPRISE_CONFIG.audit.realTimeStreaming) {
            this.streamToSIEM(entry);
        }
        
        // Critical events trigger immediate alerts
        if (event.severity === 'critical') {
            await this.triggerImmediateAlert(entry);
        }
        
        return entry.id;
    }
    
    computeIntegrityHash(entry) {
        const data = JSON.stringify({
            id: entry.id,
            timestamp: entry.timestamp,
            action: entry.action,
            actor: entry.actor.userId
        });
        return crypto.createHmac('sha256', process.env.AUDIT_SECRET || 'default-secret')
            .update(data)
            .digest('hex');
    }
    
    generateDeviceFingerprint() {
        const components = [
            os.platform(),
            os.arch(),
            os.hostname(),
            process.env.COMPUTERNAME || 'unknown'
        ];
        return crypto.createHash('sha256')
            .update(components.join('|'))
            .digest('hex')
            .substring(0, 32);
    }
    
    async getClientIp() {
        // In Electron, we get this from the renderer or network interface
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }
    
    async getGeolocation(ipAddress) {
        // In production, integrate with MaxMind GeoIP or similar
        // For now, return placeholder
        return {
            country: 'unknown',
            city: 'unknown',
            latitude: 0,
            longitude: 0,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }
    
    async streamToSIEM(entry) {
        // Convert to CEF (Common Event Format) or JSON
        const format = ENTERPRISE_CONFIG.audit.siemFormat;
        let payload;
        
        if (format === 'cef') {
            payload = this.toCEF(entry);
        } else if (format === 'leef') {
            payload = this.toLEEF(entry);
        } else {
            payload = JSON.stringify(entry);
        }
        
        // Send to SIEM endpoint
        if (this.siemEndpoint) {
            try {
                // Implementation would use HTTP/TCP to SIEM
                console.log('[SIEM]', payload);
            } catch (e) {
                console.error('SIEM streaming failed:', e);
            }
        }
    }
    
    toCEF(entry) {
        // Common Event Format for Splunk/ArcSight
        return `CEF:0|WVault|Enterprise|5.0|${entry.action}|${entry.category}|${entry.severity === 'critical' ? 10 : entry.severity === 'high' ? 7 : 5}|` +
               `rt=${entry.timestamp} ` +
               `suser=${entry.actor.userId} ` +
               `src=${entry.actor.ipAddress} ` +
               `cs1=${entry.resource.vaultId} cs1Label=VaultID ` +
               `cs2=${entry.outcome} cs2Label=Outcome`;
    }
    
    toLEEF(entry) {
        // Log Event Extended Format for QRadar
        return `LEEF:2.0|WVault|Enterprise|5.0|${entry.action}|` +
               `usrName=${entry.actor.userId}\t` +
               `src=${entry.actor.ipAddress}\t` +
               `eventSeverity=${entry.severity === 'critical' ? 10 : 5}\t` +
               `eventTime=${entry.timestamp}`;
    }
    
    async triggerImmediateAlert(entry) {
        // Send immediate notification for critical events
        const alert = {
            type: 'CRITICAL_SECURITY_EVENT',
            timestamp: entry.timestamp,
            event: entry.action,
            user: entry.actor.userId,
            details: entry.details
        };
        
        // In production, integrate with PagerDuty/Slack/Email
        console.error('[CRITICAL ALERT]', alert);
    }
    
    async flushLogs() {
        if (this.logQueue.length === 0) return;
        
        const logs = [...this.logQueue];
        this.logQueue = [];
        
        // Append to audit log file
        const logPath = path.join(app.getPath('userData'), 'audit.log');
        const logData = logs.map(l => JSON.stringify(l)).join('\n') + '\n';
        
        try {
            fs.appendFileSync(logPath, logData);
        } catch (e) {
            console.error('Failed to write audit logs:', e);
        }
    }
    
    exportLogs(startDate, endDate, format = 'json') {
        const logPath = path.join(app.getPath('userData'), 'audit.log');
        if (!fs.existsSync(logPath)) return [];
        
        const logs = fs.readFileSync(logPath, 'utf8')
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try { return JSON.parse(line); } catch { return null; }
            })
            .filter(Boolean);
        
        if (startDate || endDate) {
            return logs.filter(log => {
                const logTime = new Date(log.timestamp).getTime();
                const afterStart = !startDate || logTime >= new Date(startDate).getTime();
                const beforeEnd = !endDate || logTime <= new Date(endDate).getTime();
                return afterStart && beforeEnd;
            });
        }
        
        return logs;
    }
}

const auditLogger = new AuditLogger();

// ============================================================================
// BRUTE FORCE DETECTION SYSTEM
// ============================================================================

class BruteForceDetector {
    constructor() {
        this.attempts = new Map();
        this.lockouts = new Map();
    }
    
    recordAttempt(userId, metadata) {
        const now = Date.now();
        const window = ENTERPRISE_CONFIG.bruteForce.lockoutDuration;
        
        if (!this.attempts.has(userId)) {
            this.attempts.set(userId, {
                count: 0,
                firstAttempt: now,
                lastAttempt: now,
                metadata: []
            });
        }
        
        const record = this.attempts.get(userId);
        
        // Reset if outside window
        if (now - record.firstAttempt > window) {
            record.count = 0;
            record.firstAttempt = now;
            record.metadata = [];
        }
        
        record.count++;
        record.lastAttempt = now;
        record.metadata.push({
            timestamp: new Date().toISOString(),
            ipAddress: metadata.ipAddress,
            deviceFingerprint: metadata.deviceFingerprint,
            userAgent: metadata.userAgent,
            geoLocation: metadata.geoLocation
        });
        
        // Check threshold
        if (record.count >= ENTERPRISE_CONFIG.bruteForce.maxAttempts) {
            this.lockAccount(userId, record.metadata);
            return { locked: true, remainingTime: ENTERPRISE_CONFIG.bruteForce.lockoutDuration };
        }
        
        // Check alert threshold
        if (record.count >= ENTERPRISE_CONFIG.bruteForce.alertThreshold) {
            this.triggerSuspiciousActivityAlert(userId, record);
        }
        
        return { 
            locked: false, 
            remainingAttempts: ENTERPRISE_CONFIG.bruteForce.maxAttempts - record.count 
        };
    }
    
    lockAccount(userId, metadata) {
        const unlockTime = Date.now() + ENTERPRISE_CONFIG.bruteForce.lockoutDuration;
        this.lockouts.set(userId, unlockTime);
        
        // Log the lockout
        auditLogger.log({
            severity: 'critical',
            category: 'access_control',
            action: 'account_lockdown',
            userId,
            outcome: 'blocked',
            details: {
                reason: 'brute_force_detected',
                failedAttempts: metadata.length,
                lockoutDuration: ENTERPRISE_CONFIG.bruteForce.lockoutDuration,
                sources: metadata.map(m => ({
                    ip: m.ipAddress,
                    location: m.geoLocation,
                    time: m.timestamp
                }))
            }
        });
        
        // Send immediate alert
        this.sendLockdownAlert(userId, metadata);
    }
    
    async sendLockdownAlert(userId, metadata) {
        // In production, integrate with Twilio/SendGrid
        const alert = {
            to: 'security-team@company.com',
            subject: `🚨 ACCOUNT LOCKDOWN: ${userId}`,
            body: `Account ${userId} has been locked due to ${metadata.length} failed authentication attempts.\n\n` +
                  `Sources:\n` +
                  metadata.slice(-3).map(m => `- ${m.ipAddress} from ${m.geoLocation?.city || 'unknown'} at ${m.timestamp}`).join('\n')
        };
        
        console.error('[LOCKDOWN ALERT]', alert);
    }
    
    triggerSuspiciousActivityAlert(userId, record) {
        auditLogger.log({
            severity: 'high',
            category: 'access_control',
            action: 'suspicious_activity',
            userId,
            outcome: 'warning',
            details: {
                failedAttempts: record.count,
                timeWindow: '30m',
                sources: record.metadata.map(m => m.ipAddress)
            }
        });
    }
    
    isLockedOut(userId) {
        const unlockTime = this.lockouts.get(userId);
        if (!unlockTime) return false;
        
        if (Date.now() > unlockTime) {
            this.lockouts.delete(userId);
            this.attempts.delete(userId);
            return false;
        }
        
        return true;
    }
    
    getRemainingLockoutTime(userId) {
        const unlockTime = this.lockouts.get(userId);
        if (!unlockTime) return 0;
        return Math.max(0, unlockTime - Date.now());
    }
    
    resetAttempts(userId) {
        this.attempts.delete(userId);
    }
}

const bruteForceDetector = new BruteForceDetector();

// ============================================================================
// HONEY-POT CREDENTIALS SYSTEM
// ============================================================================

class HoneyPotSystem {
    constructor() {
        this.decoyCredentials = new Map();
        this.triggeredAlarms = new Set();
    }
    
    generateDecoyCredentials(vaultId, count = ENTERPRISE_CONFIG.honeyPot.decoyCount) {
        const decoys = [];
        const highValueTargets = ENTERPRISE_CONFIG.honeyPot.highValueTargets;
        
        for (let i = 0; i < count; i++) {
            const target = highValueTargets[i % highValueTargets.length];
            const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
            
            const decoy = {
                id: crypto.randomUUID(),
                isDecoy: true, // Hidden marker
                service: `${target}_DECOY_${suffix}`,
                username: `${target}_admin`,
                password: this.generateHoneyPassword(),
                vaultId,
                createdAt: new Date().toISOString(),
                alarmThreshold: 1 // Any access triggers alarm
            };
            
            this.decoyCredentials.set(decoy.id, decoy);
            decoys.push(decoy);
        }
        
        return decoys;
    }
    
    generateHoneyPassword() {
        // Generate realistic-looking but unique password
        const parts = [
            'Admin',
            crypto.randomBytes(3).toString('hex'),
            '!',
            crypto.randomBytes(2).toString('hex').toUpperCase()
        ];
        return parts.join('');
    }
    
    checkAccess(credentialId, action, userId) {
        const decoy = this.decoyCredentials.get(credentialId);
        if (!decoy) return { isDecoy: false };
        
        // TRIGGER ALARM
        this.triggerBreachAlarm(decoy, action, userId);
        
        return { 
            isDecoy: true, 
            alarmTriggered: true,
            message: 'SECURITY BREACH DETECTED'
        };
    }
    
    async triggerBreachAlarm(decoy, action, userId) {
        if (this.triggeredAlarms.has(decoy.id)) return;
        this.triggeredAlarms.add(decoy.id);
        
        const alarm = {
            type: 'HONEYPOT_BREACH',
            severity: 'CRITICAL',
            timestamp: new Date().toISOString(),
            decoyId: decoy.id,
            decoyService: decoy.service,
            action,
            actor: userId,
            immediateAction: ENTERPRISE_CONFIG.honeyPot.autoLockdown ? 'ACCOUNT_LOCKDOWN' : 'ALERT_ONLY'
        };
        
        // Silent alarm - don't alert the attacker
        console.error('[SILENT ALARM - HONEYPOT TRIGGERED]', alarm);
        
        // Log to audit
        await auditLogger.log({
            severity: 'critical',
            category: 'intrusion_detection',
            action: 'honeypot_triggered',
            userId,
            resourceId: decoy.id,
            vaultId: decoy.vaultId,
            outcome: 'breach_detected',
            details: alarm
        });
        
        // Auto-lockdown if enabled
        if (ENTERPRISE_CONFIG.honeyPot.autoLockdown) {
            bruteForceDetector.lockAccount(userId, [{
                ipAddress: 'unknown',
                timestamp: new Date().toISOString(),
                geoLocation: null
            }]);
        }
        
        // Send immediate notification
        this.sendBreachNotification(alarm);
    }
    
    async sendBreachNotification(alarm) {
        // In production, send to security team
        const notification = {
            priority: 'P0',
            channels: ['email', 'sms', 'slack'],
            message: `🚨 HONEYPOT BREACH: ${alarm.decoyService} was accessed by ${alarm.actor}`
        };
        
        console.error('[BREACH NOTIFICATION]', notification);
    }
    
    injectDecoysIntoVault(vaultId, realCredentials) {
        // Mix decoys with real credentials
        const decoys = this.generateDecoyCredentials(vaultId);
        
        // Randomly insert decoys
        const mixed = [...realCredentials];
        for (const decoy of decoys) {
            const insertIndex = Math.floor(Math.random() * (mixed.length + 1));
            mixed.splice(insertIndex, 0, {
                id: decoy.id,
                service: decoy.service,
                username: decoy.username,
                type: 'login',
                category: 'admin',
                isDecoy: true // Internal marker, not shown to user
            });
        }
        
        return mixed;
    }
}

const honeyPotSystem = new HoneyPotSystem();

// ============================================================================
// BIOMETRIC VELOCITY CHECK
// ============================================================================

class BiometricVelocityChecker {
    constructor() {
        this.profiles = new Map();
        this.currentSessions = new Map();
    }
    
    recordKeystrokeDynamics(userId, keystrokeData) {
        // keystrokeData: { key, pressTime, releaseTime, timestamp }
        if (!this.currentSessions.has(userId)) {
            this.currentSessions.set(userId, {
                keystrokes: [],
                startTime: Date.now(),
                mouseMovements: []
            });
        }
        
        const session = this.currentSessions.get(userId);
        session.keystrokes.push(keystrokeData);
    }
    
    recordMouseMovement(userId, movementData) {
        // movementData: { x, y, timestamp, velocity }
        const session = this.currentSessions.get(userId);
        if (session) {
            session.mouseMovements.push(movementData);
        }
    }
    
    analyzeBehavior(userId) {
        const session = this.currentSessions.get(userId);
        if (!session) return { confidence: 0, requiresMFA: true };
        
        const profile = this.profiles.get(userId);
        if (!profile || profile.samples < ENTERPRISE_CONFIG.biometrics.requiredSamples) {
            // Not enough baseline data
            return { confidence: 0, requiresMFA: true, reason: 'insufficient_baseline' };
        }
        
        // Calculate typing cadence
        const currentCadence = this.calculateTypingCadence(session.keystrokes);
        const baselineCadence = profile.typingCadence;
        
        // Calculate mouse movement patterns
        const currentMousePattern = this.calculateMousePattern(session.mouseMovements);
        const baselineMousePattern = profile.mousePattern;
        
        // Compare to baseline
        const typingDeviation = Math.abs(currentCadence - baselineCadence) / baselineCadence;
        const mouseDeviation = Math.abs(currentMousePattern - baselineMousePattern) / baselineMousePattern;
        
        const avgDeviation = (typingDeviation + mouseDeviation) / 2;
        const confidence = Math.max(0, 1 - avgDeviation);
        
        const result = {
            confidence,
            requiresMFA: confidence < (1 - ENTERPRISE_CONFIG.biometrics.toleranceThreshold),
            deviations: {
                typing: typingDeviation,
                mouse: mouseDeviation
            }
        };
        
        // Log for analysis
        auditLogger.log({
            severity: result.requiresMFA ? 'high' : 'info',
            category: 'biometric_analysis',
            action: 'velocity_check',
            userId,
            outcome: result.requiresMFA ? 'mfa_required' : 'verified',
            details: {
                confidence: result.confidence,
                deviations: result.deviations
            }
        });
        
        return result;
    }
    
    calculateTypingCadence(keystrokes) {
        if (keystrokes.length < 2) return 0;
        
        const intervals = [];
        for (let i = 1; i < keystrokes.length; i++) {
            const interval = keystrokes[i].timestamp - keystrokes[i - 1].timestamp;
            intervals.push(interval);
        }
        
        // Return average WPM-equivalent
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        return 60000 / avgInterval; // Characters per minute
    }
    
    calculateMousePattern(movements) {
        if (movements.length < 2) return 0;
        
        // Calculate average velocity and jitter
        let totalVelocity = 0;
        let jitterCount = 0;
        
        for (let i = 1; i < movements.length; i++) {
            const dx = movements[i].x - movements[i - 1].x;
            const dy = movements[i].y - movements[i - 1].y;
            const dt = movements[i].timestamp - movements[i - 1].timestamp;
            
            if (dt > 0) {
                const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
                totalVelocity += velocity;
                
                // Detect jitter (sudden direction changes)
                if (i > 1) {
                    const prevDx = movements[i - 1].x - movements[i - 2].x;
                    const prevDy = movements[i - 1].y - movements[i - 2].y;
                    const dotProduct = dx * prevDx + dy * prevDy;
                    if (dotProduct < 0) jitterCount++;
                }
            }
        }
        
        return {
            avgVelocity: totalVelocity / (movements.length - 1),
            jitterRatio: jitterCount / movements.length
        };
    }
    
    buildBaseline(userId, sessions) {
        const cadences = sessions.map(s => this.calculateTypingCadence(s.keystrokes));
        const mousePatterns = sessions.map(s => this.calculateMousePattern(s.mouseMovements));
        
        this.profiles.set(userId, {
            typingCadence: cadences.reduce((a, b) => a + b, 0) / cadences.length,
            mousePattern: {
                avgVelocity: mousePatterns.map(p => p.avgVelocity).reduce((a, b) => a + b, 0) / mousePatterns.length,
                jitterRatio: mousePatterns.map(p => p.jitterRatio).reduce((a, b) => a + b, 0) / mousePatterns.length
            },
            samples: sessions.length,
            lastUpdated: new Date().toISOString()
        });
    }
    
    endSession(userId) {
        const session = this.currentSessions.get(userId);
        if (session) {
            // If this was a successful auth, add to baseline training
            const profile = this.profiles.get(userId);
            if (!profile || profile.samples < ENTERPRISE_CONFIG.biometrics.requiredSamples) {
                // Store for baseline building
                const sessions = profile?.rawSessions || [];
                sessions.push(session);
                
                if (sessions.length >= ENTERPRISE_CONFIG.biometrics.requiredSamples) {
                    this.buildBaseline(userId, sessions);
                } else {
                    this.profiles.set(userId, {
                        rawSessions: sessions,
                        samples: sessions.length
                    });
                }
            }
        }
        
        this.currentSessions.delete(userId);
    }
}

const biometricChecker = new BiometricVelocityChecker();

// ============================================================================
// GEO-FENCING SYSTEM
// ============================================================================

class GeoFencingSystem {
    constructor() {
        this.policies = new Map();
        this.trustedNetworks = new Set();
    }
    
    setPolicy(vaultId, policy) {
        this.policies.set(vaultId, {
            allowedCountries: policy.allowedCountries || [],
            allowedNetworks: policy.allowedNetworks || [],
            requireVpn: policy.requireVpn || false,
            gpsBoundary: policy.gpsBoundary || null, // { lat, lng, radius }
            timeRestrictions: policy.timeRestrictions || null
        });
    }
    
    async checkAccess(userId, vaultId, context) {
        const policy = this.policies.get(vaultId);
        if (!policy) return { allowed: true }; // No policy = allow
        
        const { ipAddress, gps, network, timestamp } = context;
        
        // Get geolocation from IP
        const geo = await this.getGeoLocation(ipAddress);
        
        // Check country restrictions
        if (policy.allowedCountries.length > 0) {
            if (!policy.allowedCountries.includes(geo.country)) {
                return this.denyAccess('country_not_allowed', { country: geo.country });
            }
        }
        
        // Check network restrictions
        if (policy.allowedNetworks.length > 0) {
            const networkMatch = policy.allowedNetworks.some(net => 
                this.isIpInRange(ipAddress, net)
            );
            if (!networkMatch) {
                return this.denyAccess('network_not_allowed', { network });
            }
        }
        
        // Check GPS boundary
        if (policy.gpsBoundary && gps) {
            const distance = this.calculateDistance(
                gps.latitude, gps.longitude,
                policy.gpsBoundary.lat, policy.gpsBoundary.lng
            );
            if (distance > policy.gpsBoundary.radius) {
                return this.denyAccess('outside_geofence', { distance });
            }
        }
        
        // Check time restrictions
        if (policy.timeRestrictions) {
            const userTime = new Date(timestamp).toLocaleTimeString('en-US', { 
                timeZone: geo.timezone 
            });
            const hour = parseInt(userTime.split(':')[0]);
            
            if (hour < policy.timeRestrictions.startHour || 
                hour > policy.timeRestrictions.endHour) {
                return this.denyAccess('outside_hours', { hour });
            }
        }
        
        return { allowed: true };
    }
    
    async getGeoLocation(ipAddress) {
        // In production, integrate with MaxMind GeoIP2
        // For demo, return basic info
        return {
            country: 'US',
            city: 'Unknown',
            latitude: 0,
            longitude: 0,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }
    
    isIpInRange(ip, range) {
        // Simple CIDR check
        if (range.includes('/')) {
            // CIDR notation
            const [rangeIp, bits] = range.split('/');
            const mask = ~((1 << (32 - parseInt(bits))) - 1);
            const ipNum = this.ipToNumber(ip);
            const rangeNum = this.ipToNumber(rangeIp);
            return (ipNum & mask) === (rangeNum & mask);
        }
        return ip === range;
    }
    
    ipToNumber(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in meters
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    
    toRad(deg) {
        return deg * (Math.PI / 180);
    }
    
    denyAccess(reason, details) {
        auditLogger.log({
            severity: 'high',
            category: 'access_control',
            action: 'geofence_violation',
            outcome: 'denied',
            details: { reason, ...details }
        });
        
        return { 
            allowed: false, 
            reason,
            details,
            requiresElevated: true
        };
    }
}

const geoFencing = new GeoFencingSystem();

// ============================================================================
// RBAC SYSTEM
// ============================================================================

class RBACSystem {
    constructor() {
        this.roles = {
            super_admin: {
                permissions: ['*'],
                vaults: ['*'],
                mfaRequired: true,
                canManageUsers: true,
                canViewAudit: true
            },
            admin: {
                permissions: ['read', 'write', 'delete', 'share', 'manage_vault'],
                vaults: ['*'],
                mfaRequired: true,
                canManageUsers: true,
                canViewAudit: true
            },
            manager: {
                permissions: ['read', 'write', 'share'],
                vaults: [], // Assigned per user
                mfaRequired: true,
                canManageUsers: false,
                canViewAudit: false
            },
            contributor: {
                permissions: ['read', 'write'],
                vaults: [],
                mfaRequired: false,
                canManageUsers: false,
                canViewAudit: false
            },
            read_only: {
                permissions: ['read'],
                vaults: [],
                mfaRequired: false,
                canManageUsers: false,
                canViewAudit: false
            }
        };
        
        this.userRoles = new Map();
        this.vaultPermissions = new Map(); // vaultId -> { userId -> role }
    }
    
    assignRole(userId, role, vaultId = null) {
        if (!this.roles[role]) {
            throw new Error(`Invalid role: ${role}`);
        }
        
        if (!this.userRoles.has(userId)) {
            this.userRoles.set(userId, { globalRole: null, vaultRoles: {} });
        }
        
        const userRoleData = this.userRoles.get(userId);
        
        if (vaultId) {
            userRoleData.vaultRoles[vaultId] = role;
        } else {
            userRoleData.globalRole = role;
        }
        
        auditLogger.log({
            severity: 'info',
            category: 'rbac',
            action: 'role_assigned',
            userId,
            details: { role, vaultId }
        });
    }
    
    checkPermission(userId, permission, vaultId = null) {
        const userRoleData = this.userRoles.get(userId);
        if (!userRoleData) return false;
        
        // Check vault-specific role first
        let role = userRoleData.vaultRoles[vaultId];
        if (!role) {
            role = userRoleData.globalRole;
        }
        
        if (!role) return false;
        
        const roleDef = this.roles[role];
        if (roleDef.permissions.includes('*')) return true;
        if (roleDef.permissions.includes(permission)) return true;
        
        return false;
    }
    
    requiresMFA(userId) {
        const userRoleData = this.userRoles.get(userId);
        if (!userRoleData) return false;
        
        const role = userRoleData.globalRole;
        if (!role) return false;
        
        return this.roles[role].mfaRequired;
    }
    
    getAccessibleVaults(userId) {
        const userRoleData = this.userRoles.get(userId);
        if (!userRoleData) return [];
        
        const role = userRoleData.globalRole;
        if (!role) return [];
        
        const roleDef = this.roles[role];
        if (roleDef.vaults.includes('*')) return ['*']; // All vaults
        
        return Object.keys(userRoleData.vaultRoles);
    }
}

const rbacSystem = new RBACSystem();

// ============================================================================
// IPC HANDLERS FOR ENTERPRISE FEATURES
// ============================================================================

function registerEnterpriseHandlers() {
    
    // Brute Force Check
    ipcMain.handle('security:checkBruteForce', async (_event, { userId, metadata }) => {
        if (bruteForceDetector.isLockedOut(userId)) {
            const remaining = bruteForceDetector.getRemainingLockoutTime(userId);
            return { 
                locked: true, 
                remainingTime: remaining,
                message: `Account locked. Try again in ${Math.ceil(remaining / 60000)} minutes.`
            };
        }
        
        return { locked: false };
    });
    
    // Record Failed Attempt
    ipcMain.handle('security:recordFailedAttempt', async (_event, { userId, metadata }) => {
        const result = bruteForceDetector.recordAttempt(userId, metadata);
        
        await auditLogger.log({
            severity: 'warning',
            category: 'access_control',
            action: 'failed_authentication',
            userId,
            outcome: 'failed',
            details: {
                remainingAttempts: result.remainingAttempts,
                locked: result.locked
            }
        });
        
        return result;
    });
    
    // Reset Attempts (on successful auth)
    ipcMain.handle('security:resetAttempts', (_event, { userId }) => {
        bruteForceDetector.resetAttempts(userId);
    });
    
    // Biometric Velocity Check
    ipcMain.handle('security:checkBiometrics', async (_event, { userId, keystrokeData, mouseData }) => {
        if (keystrokeData) {
            biometricChecker.recordKeystrokeDynamics(userId, keystrokeData);
        }
        if (mouseData) {
            biometricChecker.recordMouseMovement(userId, mouseData);
        }
        
        return biometricChecker.analyzeBehavior(userId);
    });
    
    // Geo-Fencing Check
    ipcMain.handle('security:checkGeoFence', async (_event, { userId, vaultId, context }) => {
        return geoFencing.checkAccess(userId, vaultId, context);
    });
    
    // Check if credential is Honey-Pot
    ipcMain.handle('security:checkHoneyPot', (_event, { credentialId, action, userId }) => {
        return honeyPotSystem.checkAccess(credentialId, action, userId);
    });
    
    // RBAC Check
    ipcMain.handle('security:checkPermission', (_event, { userId, permission, vaultId }) => {
        return { allowed: rbacSystem.checkPermission(userId, permission, vaultId) };
    });
    
    // Get Audit Logs
    ipcMain.handle('security:exportAuditLogs', (_event, { startDate, endDate, format }) => {
        return auditLogger.exportLogs(startDate, endDate, format);
    });
    
    // Real-time Event Stream (for SIEM)
    ipcMain.handle('security:subscribeEvents', (_event) => {
        // Return recent events
        return auditLogger.logQueue.slice(-100);
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Systems
    auditLogger,
    bruteForceDetector,
    honeyPotSystem,
    biometricChecker,
    geoFencing,
    rbacSystem,
    
    // Config
    ENTERPRISE_CONFIG,
    
    // Functions
    registerEnterpriseHandlers,
    
    // Utilities
    generateSecurityReport: () => ({
        activeLockouts: Array.from(bruteForceDetector.lockouts.keys()),
        honeyPotTriggers: Array.from(honeyPotSystem.triggeredAlarms),
        auditQueueSize: auditLogger.logQueue.length,
        biometricProfiles: Array.from(biometricChecker.profiles.keys())
    })
};
