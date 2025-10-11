import logger from '../../config/logger.js';

/**
 * Named Entity Recognition Engine
 * Extracts and classifies entities from text
 */
class NEREngine {
  constructor() {
    // Indian phone number patterns
    this.indianPhonePattern = /(\+91|91|0)?[6-9]\d{9}/g;
    
    // Foreign phone number patterns (international format)
    this.foreignPhonePattern = /\+(?!91)\d{1,3}[\s-]?\d{6,14}/g;
    
    // Crypto address patterns
    this.bitcoinPattern = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g;
    this.ethereumPattern = /\b0x[a-fA-F0-9]{40}\b/g;
    this.upiPattern = /\b[\w.-]+@[\w.-]+\b/g; // UPI IDs
    
    // IP address pattern
    this.ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    
    // Email pattern
    this.emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    
    // URL pattern
    this.urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    
    // Aadhaar pattern (12 digits)
    this.aadhaarPattern = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
    
    // PAN card pattern
    this.panPattern = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g;
    
    // Bank account pattern (9-18 digits)
    this.bankAccountPattern = /\b\d{9,18}\b/g;
    
    // IFSC code pattern
    this.ifscPattern = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;
  }

  /**
   * Extract all entities from text
   */
  extractEntities(text, evidenceType, evidenceId) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const entities = [];

    // Extract phone numbers
    entities.push(...this.extractPhoneNumbers(text, evidenceType, evidenceId));
    
    // Extract crypto addresses
    entities.push(...this.extractCryptoAddresses(text, evidenceType, evidenceId));
    
    // Extract IP addresses
    entities.push(...this.extractIPAddresses(text, evidenceType, evidenceId));
    
    // Extract emails
    entities.push(...this.extractEmails(text, evidenceType, evidenceId));
    
    // Extract URLs
    entities.push(...this.extractURLs(text, evidenceType, evidenceId));
    
    // Extract Indian identity numbers
    entities.push(...this.extractIndianIDs(text, evidenceType, evidenceId));
    
    // Extract financial information
    entities.push(...this.extractFinancialInfo(text, evidenceType, evidenceId));

    return entities;
  }

  /**
   * Extract and classify phone numbers
   */
  extractPhoneNumbers(text, evidenceType, evidenceId) {
    const entities = [];
    
    // Extract Indian phone numbers
    const indianMatches = text.matchAll(this.indianPhonePattern);
    for (const match of indianMatches) {
      const phoneNumber = match[0].replace(/^(\+91|91|0)/, '');
      
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'phone_number',
        entityValue: phoneNumber,
        entityMetadata: {
          country: 'India',
          isForeign: false,
          originalFormat: match[0]
        },
        confidenceScore: 0.95,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    // Extract foreign phone numbers
    const foreignMatches = text.matchAll(this.foreignPhonePattern);
    for (const match of foreignMatches) {
      const countryCode = match[0].match(/\+(\d{1,3})/)?.[1];
      
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'phone_number',
        entityValue: match[0],
        entityMetadata: {
          country: this.getCountryFromCode(countryCode),
          isForeign: true,
          countryCode: countryCode,
          originalFormat: match[0]
        },
        confidenceScore: 0.90,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    return entities;
  }

  /**
   * Extract cryptocurrency addresses
   */
  extractCryptoAddresses(text, evidenceType, evidenceId) {
    const entities = [];
    
    // Bitcoin addresses
    const btcMatches = text.matchAll(this.bitcoinPattern);
    for (const match of btcMatches) {
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'crypto_address',
        entityValue: match[0],
        entityMetadata: {
          cryptocurrency: 'Bitcoin',
          addressType: 'BTC'
        },
        confidenceScore: 0.85,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    // Ethereum addresses
    const ethMatches = text.matchAll(this.ethereumPattern);
    for (const match of ethMatches) {
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'crypto_address',
        entityValue: match[0],
        entityMetadata: {
          cryptocurrency: 'Ethereum',
          addressType: 'ETH'
        },
        confidenceScore: 0.90,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    // UPI IDs
    const upiMatches = text.matchAll(this.upiPattern);
    for (const match of upiMatches) {
      if (match[0].includes('@')) {
        entities.push({
          evidenceType,
          evidenceId,
          entityType: 'upi_id',
          entityValue: match[0],
          entityMetadata: {
            paymentMethod: 'UPI',
            provider: match[0].split('@')[1]
          },
          confidenceScore: 0.80,
          startPosition: match.index,
          endPosition: match.index + match[0].length
        });
      }
    }
    
    return entities;
  }

  /**
   * Extract IP addresses
   */
  extractIPAddresses(text, evidenceType, evidenceId) {
    const entities = [];
    const matches = text.matchAll(this.ipPattern);
    
    for (const match of matches) {
      // Validate IP address
      const parts = match[0].split('.');
      if (parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255)) {
        entities.push({
          evidenceType,
          evidenceId,
          entityType: 'ip_address',
          entityValue: match[0],
          entityMetadata: {
            type: 'IPv4',
            isPrivate: this.isPrivateIP(match[0])
          },
          confidenceScore: 0.95,
          startPosition: match.index,
          endPosition: match.index + match[0].length
        });
      }
    }
    
    return entities;
  }

  /**
   * Extract email addresses
   */
  extractEmails(text, evidenceType, evidenceId) {
    const entities = [];
    const matches = text.matchAll(this.emailPattern);
    
    for (const match of matches) {
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'email',
        entityValue: match[0],
        entityMetadata: {
          domain: match[0].split('@')[1]
        },
        confidenceScore: 0.90,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    return entities;
  }

  /**
   * Extract URLs
   */
  extractURLs(text, evidenceType, evidenceId) {
    const entities = [];
    const matches = text.matchAll(this.urlPattern);
    
    for (const match of matches) {
      try {
        const url = new URL(match[0]);
        entities.push({
          evidenceType,
          evidenceId,
          entityType: 'url',
          entityValue: match[0],
          entityMetadata: {
            domain: url.hostname,
            protocol: url.protocol
          },
          confidenceScore: 0.95,
          startPosition: match.index,
          endPosition: match.index + match[0].length
        });
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
    return entities;
  }

  /**
   * Extract Indian identity numbers
   */
  extractIndianIDs(text, evidenceType, evidenceId) {
    const entities = [];
    
    // Aadhaar numbers
    const aadhaarMatches = text.matchAll(this.aadhaarPattern);
    for (const match of aadhaarMatches) {
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'aadhaar',
        entityValue: match[0].replace(/\s/g, ''),
        entityMetadata: {
          type: 'Indian Identity',
          masked: this.maskAadhaar(match[0])
        },
        confidenceScore: 0.75,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    // PAN card numbers
    const panMatches = text.matchAll(this.panPattern);
    for (const match of matches) {
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'pan_card',
        entityValue: match[0],
        entityMetadata: {
          type: 'Indian Tax ID'
        },
        confidenceScore: 0.85,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    return entities;
  }

  /**
   * Extract financial information
   */
  extractFinancialInfo(text, evidenceType, evidenceId) {
    const entities = [];
    
    // IFSC codes
    const ifscMatches = text.matchAll(this.ifscPattern);
    for (const match of ifscMatches) {
      entities.push({
        evidenceType,
        evidenceId,
        entityType: 'ifsc_code',
        entityValue: match[0],
        entityMetadata: {
          type: 'Bank Identifier',
          bankCode: match[0].substring(0, 4)
        },
        confidenceScore: 0.90,
        startPosition: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    return entities;
  }

  /**
   * Get country from country code
   */
  getCountryFromCode(code) {
    const countryCodes = {
      '1': 'USA/Canada',
      '44': 'UK',
      '86': 'China',
      '92': 'Pakistan',
      '880': 'Bangladesh',
      '971': 'UAE',
      '966': 'Saudi Arabia',
      '65': 'Singapore',
      '60': 'Malaysia'
    };
    
    return countryCodes[code] || 'Unknown';
  }

  /**
   * Check if IP is private
   */
  isPrivateIP(ip) {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  /**
   * Mask Aadhaar number for privacy
   */
  maskAadhaar(aadhaar) {
    const clean = aadhaar.replace(/\s/g, '');
    return 'XXXX XXXX ' + clean.substring(8);
  }
}

export default new NEREngine();
