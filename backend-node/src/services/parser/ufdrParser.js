import xml2js from 'xml2js';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import path from 'path';
import logger from '../../config/logger.js';

/**
 * UFDR/Cellebrite XML Parser
 * Parses forensic data from UFDR and Cellebrite XML files
 */
class UFDRParser {
  constructor() {
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      trim: true
    });
  }

  /**
   * Parse UFDR XML file (handles both plain XML and ZIP archives)
   */
  async parseUFDRFile(filePath) {
    try {
      logger.info(`Parsing UFDR file: ${filePath}`);
      
      // Read file to check if it's a ZIP
      const fileBuffer = await fs.readFile(filePath);
      const isZip = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B; // PK signature
      
      let xmlContent;
      
      if (isZip) {
        logger.info('Detected ZIP archive, extracting...');
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();
        
        // Find XML file in the ZIP
        const xmlEntry = zipEntries.find(entry => 
          entry.entryName.toLowerCase().endsWith('.xml') && !entry.isDirectory
        );
        
        if (!xmlEntry) {
          throw new Error('No XML file found in the ZIP archive. UFDR files should contain an XML export.');
        }
        
        logger.info(`Found XML file in ZIP: ${xmlEntry.entryName}`);
        xmlContent = xmlEntry.getData().toString('utf-8');
      } else {
        // Plain XML file
        xmlContent = fileBuffer.toString('utf-8');
      }
      
      // Check if content is actually XML
      const trimmedContent = xmlContent.trim();
      if (!trimmedContent.startsWith('<?xml') && !trimmedContent.startsWith('<')) {
        throw new Error('Invalid UFDR file format. File must contain valid XML. Please ensure you are uploading a proper UFDR/XML export file.');
      }
      
      const result = await this.parser.parseStringPromise(xmlContent);
      
      // Extract device information
      const deviceInfo = this.extractDeviceInfo(result);
      
      // Extract data sources
      const dataSources = this.extractDataSources(result);
      
      return {
        deviceInfo,
        dataSources,
        rawData: result
      };
    } catch (error) {
      logger.error('Error parsing UFDR file:', error);
      
      // Provide more helpful error messages
      if (error.message.includes('Non-whitespace before first tag')) {
        throw new Error('Invalid UFDR file format. The file does not appear to be valid XML. Please upload a proper UFDR/Cellebrite XML export file.');
      }
      
      throw new Error(`Failed to parse UFDR file: ${error.message}`);
    }
  }

  /**
   * Parse JSON UFDR file
   */
  async parseJSONFile(filePath) {
    try {
      logger.info(`Parsing JSON UFDR file: ${filePath}`);
      
      const jsonContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(jsonContent);
      
      return {
        deviceInfo: data.device || {},
        dataSources: data.sources || [],
        rawData: data
      };
    } catch (error) {
      logger.error('Error parsing JSON file:', error);
      throw new Error(`Failed to parse JSON file: ${error.message}`);
    }
  }

  /**
   * Extract device information from parsed XML
   */
  extractDeviceInfo(parsedData) {
    try {
      const device = parsedData.root?.device || parsedData.device || {};
      
      return {
        deviceName: device.name || device.model || 'Unknown Device',
        deviceType: device.type || 'smartphone',
        imei: device.imei || device.IMEI || null,
        phoneNumber: device.phoneNumber || device.msisdn || null,
        ownerName: device.owner || device.ownerName || null,
        manufacturer: device.manufacturer || null,
        model: device.model || null,
        osVersion: device.osVersion || device.os || null,
        extractionDate: device.extractionDate || new Date()
      };
    } catch (error) {
      logger.warn('Error extracting device info:', error);
      return {
        deviceName: 'Unknown Device',
        deviceType: 'smartphone',
        extractionDate: new Date()
      };
    }
  }

  /**
   * Extract data sources from parsed XML
   */
  extractDataSources(parsedData) {
    try {
      const sources = [];
      const root = parsedData.root || parsedData;
      
      // Extract SMS/Messages
      if (root.messages || root.sms) {
        const messages = this.normalizeArray(root.messages || root.sms);
        sources.push({
          sourceType: 'sms',
          appName: 'Messages',
          data: this.parseMessages(messages),
          totalRecords: Array.isArray(messages) ? messages.length : 0
        });
      }
      
      // Extract Call Logs
      if (root.calls || root.callLogs) {
        const calls = this.normalizeArray(root.calls || root.callLogs);
        sources.push({
          sourceType: 'call_log',
          appName: 'Phone',
          data: this.parseCallLogs(calls),
          totalRecords: Array.isArray(calls) ? calls.length : 0
        });
      }
      
      // Extract Contacts
      if (root.contacts) {
        const contacts = this.normalizeArray(root.contacts);
        sources.push({
          sourceType: 'contacts',
          appName: 'Contacts',
          data: this.parseContacts(contacts),
          totalRecords: Array.isArray(contacts) ? contacts.length : 0
        });
      }
      
      // Extract WhatsApp
      if (root.whatsapp || root.WhatsApp) {
        const whatsapp = this.normalizeArray(root.whatsapp || root.WhatsApp);
        sources.push({
          sourceType: 'whatsapp',
          appName: 'WhatsApp',
          data: this.parseWhatsApp(whatsapp),
          totalRecords: Array.isArray(whatsapp) ? whatsapp.length : 0
        });
      }
      
      // Extract Telegram
      if (root.telegram || root.Telegram) {
        const telegram = this.normalizeArray(root.telegram || root.Telegram);
        sources.push({
          sourceType: 'telegram',
          appName: 'Telegram',
          data: this.parseTelegram(telegram),
          totalRecords: Array.isArray(telegram) ? telegram.length : 0
        });
      }
      
      return sources;
    } catch (error) {
      logger.error('Error extracting data sources:', error);
      return [];
    }
  }

  /**
   * Parse SMS/Messages
   */
  parseMessages(messages) {
    const messageArray = this.normalizeArray(messages);
    return messageArray.map((msg, index) => ({
      id: msg.id || `msg_${index}`,
      type: msg.type || 'sms',
      direction: msg.direction || (msg.type === 'sent' ? 'outgoing' : 'incoming'),
      phoneNumber: msg.address || msg.phoneNumber || msg.number,
      content: msg.body || msg.text || msg.content,
      timestamp: msg.date || msg.timestamp || new Date(),
      read: msg.read === 'true' || msg.read === true,
      threadId: msg.threadId || null
    }));
  }

  /**
   * Parse Call Logs
   */
  parseCallLogs(calls) {
    const callArray = this.normalizeArray(calls);
    return callArray.map((call, index) => ({
      id: call.id || `call_${index}`,
      type: call.type || 'voice',
      direction: call.direction || call.callType,
      phoneNumber: call.number || call.phoneNumber || call.address,
      duration: parseInt(call.duration) || 0,
      timestamp: call.date || call.timestamp || new Date(),
      name: call.name || call.contactName || null
    }));
  }

  /**
   * Parse Contacts
   */
  parseContacts(contacts) {
    const contactArray = this.normalizeArray(contacts);
    return contactArray.map((contact, index) => ({
      id: contact.id || `contact_${index}`,
      name: contact.name || contact.displayName,
      phoneNumbers: this.normalizeArray(contact.phoneNumbers || contact.phone || []),
      emails: this.normalizeArray(contact.emails || contact.email || []),
      organization: contact.organization || contact.company || null,
      notes: contact.notes || null
    }));
  }

  /**
   * Parse WhatsApp messages
   */
  parseWhatsApp(whatsapp) {
    const msgArray = this.normalizeArray(whatsapp);
    return msgArray.map((msg, index) => ({
      id: msg.id || `wa_${index}`,
      chatId: msg.chatId || msg.jid,
      sender: msg.sender || msg.from,
      content: msg.message || msg.text || msg.content,
      timestamp: msg.timestamp || msg.date || new Date(),
      mediaType: msg.mediaType || msg.type || 'text',
      mediaPath: msg.mediaPath || msg.media || null,
      isGroup: msg.isGroup === 'true' || msg.isGroup === true
    }));
  }

  /**
   * Parse Telegram messages
   */
  parseTelegram(telegram) {
    const msgArray = this.normalizeArray(telegram);
    return msgArray.map((msg, index) => ({
      id: msg.id || `tg_${index}`,
      chatId: msg.chatId,
      sender: msg.sender || msg.from,
      content: msg.message || msg.text || msg.content,
      timestamp: msg.timestamp || msg.date || new Date(),
      mediaType: msg.mediaType || msg.type || 'text',
      mediaPath: msg.mediaPath || msg.media || null
    }));
  }

  /**
   * Normalize data to array
   */
  normalizeArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
      // If it's an object with numeric keys, convert to array
      const keys = Object.keys(data);
      if (keys.every(k => !isNaN(k))) {
        return Object.values(data);
      }
      return [data];
    }
    return [];
  }
}

const parserInstance = new UFDRParser();

export const parseUFDRFile = async (filePath) => {
  const ext = filePath.split('.').pop().toLowerCase();
  
  if (ext === 'json') {
    return await parserInstance.parseJSONFile(filePath);
  } else if (ext === 'xml' || ext === 'ufdr') {
    return await parserInstance.parseUFDRFile(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
};

export default parserInstance;
