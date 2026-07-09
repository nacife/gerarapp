"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
/**
 * Segredo cifrado reversível (AES-256-GCM) — usado para o secret TOTP (apps/api)
 * e para o secret de assinatura de webhooks (apps/api cifra, apps/worker decifra
 * para assinar a entrega). Compartilhado pela mesma razão de `webhooks.ts`:
 * pacotes não podem depender de apps.
 */
const node_crypto_1 = require("node:crypto");
function deriveKey(secret) {
    return (0, node_crypto_1.createHash)('sha256').update(secret, 'utf8').digest();
}
function encryptSecret(plaintext, keySecret) {
    const key = deriveKey(keySecret);
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: enc.toString('base64'),
    };
}
function decryptSecret(sealed, keySecret) {
    const key = deriveKey(keySecret);
    const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]);
    return dec.toString('utf8');
}
//# sourceMappingURL=crypto.js.map