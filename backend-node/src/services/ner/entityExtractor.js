import logger from '../../config/logger.js';

/**
 * Entity Extractor using Regex patterns
 * Extracts entities like phone numbers, emails, crypto addresses, etc.
 */

// Regex patterns for entity extraction
const patterns = {
  phone_number: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  crypto_address: {
    bitcoin: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b|bc1[a-z0-9]{39,59}\b/g,
    ethereum: /0x[a-fA-F0-9]{40}\b/g,
    upi: /[\w.-]+@[\w.-]+/g
  },
  ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
  indian_id: {
    aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    pan: /[A-Z]{5}\d{4}[A-Z]{1}/g,
    passport: /[A-Z]\d{7}/g
  },
  bank_account: /\b\d{9,18}\b/g,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/g
};

/**
 * Extract entities from text
 */
export const extractEntities = async (parsedData) => {
  const entities = [];
  const seenEntities = new Set();

  try {
    // Extract from all data sources
    if (parsedData.dataSources) {
      for (const source of parsedData.dataSources) {
        for (const record of source.data || []) {
          const text = record.content || record.message || record.body || '';
          
          if (text) {
            // Extract phone numbers
            const phones = extractPhoneNumbers(text);
            phones.forEach(phone => {
              const key = `phone:${phone.value}`;
              if (!seenEntities.has(key)) {
                entities.push(phone);
                seenEntities.add(key);
              }
            });

            // Extract emails
            const emails = extractEmails(text);
            emails.forEach(email => {
              const key = `email:${email.value}`;
              if (!seenEntities.has(key)) {
                entities.push(email);
                seenEntities.add(key);
              }
            });

            // Extract crypto addresses
            const cryptoAddresses = extractCryptoAddresses(text);
            cryptoAddresses.forEach(crypto => {
              const key = `crypto:${crypto.value}`;
              if (!seenEntities.has(key)) {
                entities.push(crypto);
                seenEntities.add(key);
              }
            });

            // Extract IP addresses
            const ips = extractIPAddresses(text);
            ips.forEach(ip => {
              const key = `ip:${ip.value}`;
              if (!seenEntities.has(key)) {
                entities.push(ip);
                seenEntities.add(key);
              }
            });

            // Extract URLs
            const urls = extractURLs(text);
            urls.forEach(url => {
              const key = `url:${url.value}`;
              if (!seenEntities.has(key)) {
                entities.push(url);
                seenEntities.add(key);
              }
            });

            // Extract Indian IDs
            const indianIds = extractIndianIDs(text);
            indianIds.forEach(id => {
              const key = `id:${id.value}`;
              if (!seenEntities.has(key)) {
                entities.push(id);
                seenEntities.add(key);
              }
            });
          }

          // Extract phone numbers from record fields
          if (record.phoneNumber) {
            const phone = classifyPhoneNumber(record.phoneNumber);
            const key = `phone:${phone.value}`;
            if (!seenEntities.has(key)) {
              entities.push(phone);
              seenEntities.add(key);
            }
          }
        }
      }
    }

    logger.info(`Extracted ${entities.length} unique entities`);
    return entities;

  } catch (error) {
    logger.error('Error extracting entities:', error);
    return [];
  }
};

/**
 * Extract and classify phone numbers
 */
function extractPhoneNumbers(text) {
  const matches = text.match(patterns.phone_number) || [];
  return matches.map(phone => classifyPhoneNumber(phone));
}

/**
 * Classify phone number (Indian/Foreign)
 */
function classifyPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  const isIndian = cleaned.startsWith('91') || (cleaned.length === 10 && !cleaned.startsWith('0'));
  const isForeign = cleaned.startsWith('+') && !cleaned.startsWith('+91');

  return {
    type: 'phone_number',
    value: phone,
    metadata: {
      isIndian,
      isForeign,
      cleaned
    },
    confidence: 0.95
  };
}

/**
 * Extract emails
 */
function extractEmails(text) {
  const matches = text.match(patterns.email) || [];
  return matches.map(email => ({
    type: 'email',
    value: email.toLowerCase(),
    confidence: 0.9
  }));
}

/**
 * Extract crypto addresses
 */
function extractCryptoAddresses(text) {
  const entities = [];

  // Bitcoin
  const btcMatches = text.match(patterns.crypto_address.bitcoin) || [];
  btcMatches.forEach(addr => {
    entities.push({
      type: 'crypto_address',
      value: addr,
      metadata: { currency: 'bitcoin' },
      confidence: 0.85
    });
  });

  // Ethereum
  const ethMatches = text.match(patterns.crypto_address.ethereum) || [];
  ethMatches.forEach(addr => {
    entities.push({
      type: 'crypto_address',
      value: addr,
      metadata: { currency: 'ethereum' },
      confidence: 0.85
    });
  });

  return entities;
}

/**
 * Extract IP addresses
 */
function extractIPAddresses(text) {
  const matches = text.match(patterns.ip_address) || [];
  return matches
    .filter(ip => isValidIP(ip))
    .map(ip => ({
      type: 'ip_address',
      value: ip,
      confidence: 0.8
    }));
}

/**
 * Validate IP address
 */
function isValidIP(ip) {
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part);
    return num >= 0 && num <= 255;
  });
}

/**
 * Extract URLs
 */
function extractURLs(text) {
  const matches = text.match(patterns.url) || [];
  return matches.map(url => ({
    type: 'url',
    value: url,
    confidence: 0.9
  }));
}

/**
 * Extract Indian ID numbers
 */
function extractIndianIDs(text) {
  const entities = [];

  // Aadhaar
  const aadhaarMatches = text.match(patterns.indian_id.aadhaar) || [];
  aadhaarMatches.forEach(id => {
    entities.push({
      type: 'indian_id',
      value: id,
      metadata: { idType: 'aadhaar' },
      confidence: 0.7
    });
  });

  // PAN
  const panMatches = text.match(patterns.indian_id.pan) || [];
  panMatches.forEach(id => {
    entities.push({
      type: 'indian_id',
      value: id,
      metadata: { idType: 'pan' },
      confidence: 0.85
    });
  });

  // Passport
  const passportMatches = text.match(patterns.indian_id.passport) || [];
  passportMatches.forEach(id => {
    entities.push({
      type: 'indian_id',
      value: id,
      metadata: { idType: 'passport' },
      confidence: 0.75
    });
  });

  return entities;
}

/**
 * Extract entities from a single text string
 */
export const extractFromText = (text) => {
  const entities = [];

  entities.push(...extractPhoneNumbers(text));
  entities.push(...extractEmails(text));
  entities.push(...extractCryptoAddresses(text));
  entities.push(...extractIPAddresses(text));
  entities.push(...extractURLs(text));
  entities.push(...extractIndianIDs(text));

  return entities;
};

export default {
  extractEntities,
  extractFromText
};
