const crypto = require('crypto');

function base32Decode(encoded) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = Buffer.alloc(encoded.length * 5 / 8 | 0);
    let index = 0;

    for (const char of encoded.toUpperCase()) {
        const val = alphabet.indexOf(char);
        if (val === -1) continue;
        value = (value << 5) | val;
        bits += 5;
        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return output;
}

function generateTOTP(secret, window = 0) {
    if (!secret) return null;
    try {
        const key = base32Decode(secret.replace(/\s+/g, ''));
        if (key.length === 0) return null;

        const epoch = Math.floor(Date.now() / 1000);
        const time = Buffer.alloc(8);
        const counter = Math.floor(epoch / 30) + window;

        // Write counter as BigEndian 64-bit integer
        time.writeBigUInt64BE(BigInt(counter));

        const hmac = crypto.createHmac('sha1', key);
        hmac.update(time);
        const hash = hmac.digest();

        const offset = hash[hash.length - 1] & 0xf;
        const binary =
            ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff);

        const otp = binary % 1000000;
        return otp.toString().padStart(6, '0');
    } catch (e) {
        return null;
    }
}

module.exports = { generateTOTP };
