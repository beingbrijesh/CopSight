import crypto from 'crypto';
import logger from '../config/logger.js';

export const decryptPayload = (req, res, next) => {
  try {
    // Only decrypt if the request body contains the AES-256-GCM structure
    if (req.body && req.body.ciphertext && req.body.iv && req.body.tag) {
      if (!req.user || !req.user.sessionEncryptionKey) {
        return res.status(401).json({ success: false, message: 'Missing session encryption key for decryption' });
      }

      const { ciphertext, iv, tag } = req.body;
      const key = Buffer.from(req.user.sessionEncryptionKey, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(iv, 'hex'), key);
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Replace the request body with the decrypted JSON payload
      req.body = JSON.parse(decrypted);
    }
    
    next();
  } catch (error) {
    logger.error('Payload decryption failed:', error);
    return res.status(400).json({ success: false, message: 'Payload decryption failed' });
  }
};
