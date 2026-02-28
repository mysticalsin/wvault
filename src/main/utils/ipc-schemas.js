/**
 * WVault IPC Input Validation Schemas (Zod)
 * ============================================================================
 * Enforces strict type safety, max lengths, and prevents prototype pollution
 * on all IPC handler inputs in the Electron main process.
 */

const { z } = require('zod');

// ─── Credential Schemas ──────────────────────────────────────────────────────

const SaveCredentialSchema = z.object({
    id: z.number().int().positive().optional(),
    service: z.string().min(1, 'Service name is required').max(256),
    username: z.string().max(1024).default(''),
    password: z.string().max(1000).default(''),
    url: z.string().max(2048).default(''),
    notes: z.string().max(10000).default(''),
    category: z.string().max(50).default('general'),
    type: z.enum(['login', 'card', 'note']).default('login'),
    totp: z.string().max(256).default(''),
    icon_url: z.string().max(2048).nullable().optional(),
    favorite: z.number().int().min(0).max(1).default(0),
    gamePlatform: z.string().max(100).nullable().optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    card: z.object({
        holder: z.string().max(256).default(''),
        number: z.string().max(19).default(''),
        expiry: z.string().max(10).default(''),
        cvv: z.string().max(4).default(''),
        pin: z.string().max(12).default(''),
    }).optional(),
}).passthrough(); // .passthrough() allows extra keys safely (main process only destructures known fields)

// ─── Folder Schemas ──────────────────────────────────────────────────────────

const CreateFolderSchema = z.object({
    name: z.string().min(1, 'Folder name is required').max(100),
    password: z.string().max(1000).optional(),
}).strict();

const UnlockFolderSchema = z.object({
    id: z.number().int().positive(),
    password: z.string().min(1).max(1000),
}).strict();

// ─── Auth Schemas ────────────────────────────────────────────────────────────

const MasterPasswordSchema = z.object({
    password: z.string().min(1).max(1000),
    name: z.string().max(256).optional(),
}).strict();

const PinSchema = z.object({
    pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits'),
}).strict();

// ─── Search Schema ───────────────────────────────────────────────────────────

const SearchSchema = z.object({
    query: z.string().max(256).default(''),
    category: z.string().max(50).optional(),
    type: z.enum(['login', 'card', 'note', 'all']).default('all'),
}).strict();

// ─── Settings Schema ─────────────────────────────────────────────────────────

const SettingsSchema = z.record(
    z.string().max(100),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
).refine(
    (obj) => Object.keys(obj).length <= 100,
    { message: 'Too many settings keys' }
);

// ─── Attachment Schema ───────────────────────────────────────────────────────

const AttachmentIdSchema = z.number().int().positive();
const CredentialIdSchema = z.number().int().positive();

// ─── Validation Helper ───────────────────────────────────────────────────────

/**
 * Validate IPC input against a Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 * @param {z.ZodSchema} schema
 * @param {unknown} input
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
function validateIpcInput(schema, input) {
    const result = schema.safeParse(input);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const firstError = result.error.issues[0];
    return {
        success: false,
        error: `Validation failed: ${firstError.path.join('.')} — ${firstError.message}`,
    };
}

module.exports = {
    SaveCredentialSchema,
    CreateFolderSchema,
    UnlockFolderSchema,
    MasterPasswordSchema,
    PinSchema,
    SearchSchema,
    SettingsSchema,
    AttachmentIdSchema,
    CredentialIdSchema,
    validateIpcInput,
};
