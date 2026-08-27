import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';

const getSecretKey = () => {
    return crypto.scryptSync(env.JWT_SECRET, 'optiwaste-salt', 32);
};

export const encryptCredentials = (text: string) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        credentials: encrypted,
        credentials_iv: iv.toString('hex'),
        auth_tag: authTag
    };
};

export const decryptCredentials = (encryptedData: string, iv: string, authTag: string) => {
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
