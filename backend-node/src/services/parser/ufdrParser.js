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

  logRawMessage(message) {
    console.log('[RAW MESSAGE]', message);
  }

  /**
   * More lenient XML sanitation to fix forensic tool export bugs
   * (e.g. redundant </ufdr:http> tags identified in Job 7)
   */
  sanitizeXML(xml) {
    try {
      logger.info('Sanitizing XML structure before parsing...');
      
      // 1. Initial cleanup: Remove comments to avoid parsing issues inside them
      let content = xml.replace(/<!--[\s\S]*?-->/g, '');
      
      // 2. Structural Fix with tag injection
      const tagRegex = /<(\/?[a-zA-Z0-9:_.-]+)(?:\s+[^>]*?)?>/g;
      const stack = [];
      let match;
      let sanitized = content;
      let offset = 0; // Track change in string length to adjust indices

      // Re-scan properly with the current string or a copy
      // To be safe and simple, let's build the new string
      let result = '';
      let lastIndex = 0;

      while ((match = tagRegex.exec(content)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const index = match.index;

        // Add everything before the tag
        result += content.substring(lastIndex, index);

        if (tagName.startsWith('!--') || tagName.startsWith('![CDATA[')) {
            result += fullTag;
            lastIndex = index + fullTag.length;
            continue;
        }

        if (tagName.startsWith('/')) {
          const closingName = tagName.substring(1);
          const stackIndex = stack.lastIndexOf(closingName);
          
          if (stackIndex !== -1) {
            // Found a matching opener in stack.
            // Check if there are unclosed tags on top of it.
            if (stack.length - 1 > stackIndex) {
                const skipped = stack.slice(stackIndex + 1).reverse();
                logger.warn(`Lenient parser: Injecting missing closers for ${skipped.join(', ')} before </${closingName}>`);
                for (const skippedTag of skipped) {
                    result += `</${skippedTag}>`;
                }
            }
            // Pop everything up to and including the matching tag
            while (stack.length > stackIndex) {
               stack.pop();
            }
            result += fullTag;
          } else {
            // No matching opener! 
            logger.warn(`Removing redundant closing tag </${closingName}>`);
            // Do NOT add to result (effectively removing it)
          }
        } else if (fullTag.endsWith('/>')) {
            // Self-closing
            result += fullTag;
        } else {
            // Regular opening tag
            stack.push(tagName);
            result += fullTag;
        }
        
        lastIndex = index + fullTag.length;
      }

      // Add the rest of the string
      result += content.substring(lastIndex);

      // 3. Close any remaining unclosed tags at the end
      if (stack.length > 0) {
        logger.info(`Closing unclosed tags at end of file: ${stack.join(', ')}`);
        while (stack.length > 0) {
          const tag = stack.pop();
          result += `</${tag}>`;
        }
      }

      return result;
    } catch (error) {
      logger.error('Error during XML sanitization:', error);
      return xml;
    }
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

      // Sanitize XML to fix common forensic tool bugs (e.g., redundant closing tags)
      const sanitizedXml = this.sanitizeXML(xmlContent);

      const result = await this.parser.parseStringPromise(sanitizedXml);

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

      // Extract device information from metadata
      const deviceInfo = {
        deviceName: data.metadata?.device || 'Unknown Device',
        deviceType: 'smartphone',
        manufacturer: 'Unknown',
        model: 'Unknown Model',
        osVersion: null,
        extractionDate: data.metadata?.extraction_date || new Date(),
        tool: data.metadata?.tool || 'Unknown'
      };

      // Create data sources from JSON structure
      const dataSources = [];

      // Contacts
      if (data.contacts && Array.isArray(data.contacts)) {
        dataSources.push({
          sourceType: 'contacts',
          appName: 'Contacts',
          data: data.contacts.map((contact, index) => ({
            id: contact.id || `contact_${index}`,
            name: contact.name,
            phone: contact.phone, // Keep original field name for compatibility
            timestamp: new Date()
          })),
          totalRecords: data.contacts.length
        });
      }

      // Chats/Messages
      if (data.chats && Array.isArray(data.chats)) {
        const chatData = data.chats.map((chat, index) => {
          const message = {
            id: `chat_${index}`,
            sender: chat.sender,
            receiver: chat.receiver,
            message: chat.message, // Use 'message' as content field
            timestamp: chat.timestamp
          };
          this.logRawMessage(message);
          return message;
        });

        dataSources.push({
          sourceType: 'chat',
          appName: 'Chat',
          data: chatData,
          totalRecords: data.chats.length
        });
      }

      // Calls
      if (data.calls && Array.isArray(data.calls)) {
        dataSources.push({
          sourceType: 'call_log',
          appName: 'Phone',
          data: data.calls.map((call, index) => ({
            id: `call_${index}`,
            caller: call.caller,
            receiver: call.receiver,
            duration: call.duration,
            timestamp: call.timestamp
          })),
          totalRecords: data.calls.length
        });
      }

      // Images
      if (data.images && Array.isArray(data.images)) {
        dataSources.push({
          sourceType: 'media',
          appName: 'Gallery',
          data: data.images.map((image, index) => ({
            id: `image_${index}`,
            path: image.path,
            description: image.description,
            timestamp: image.timestamp,
            type: 'image'
          })),
          totalRecords: data.images.length
        });
      }

      // Videos
      if (data.videos && Array.isArray(data.videos)) {
        dataSources.push({
          sourceType: 'media',
          appName: 'Gallery',
          data: data.videos.map((video, index) => ({
            id: `video_${index}`,
            path: video.path,
            description: video.description,
            timestamp: video.timestamp,
            type: 'video'
          })),
          totalRecords: data.videos.length
        });
      }

      return {
        deviceInfo,
        dataSources,
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
      // Handle UFDR XML structure
      const ufdr = parsedData['ufdr:UFDR'] || parsedData.UFDR || parsedData;
      const device = ufdr['ufdr:device'] || ufdr.device || ufdr['ufdr:network'] || ufdr.network || {};
      const deviceInfo = device['ufdr:deviceInfo'] || device.deviceInfo || ufdr['ufdr:metadata'] || ufdr.metadata || {};

      // If we have actual UFDR device info, use it
      if (deviceInfo['ufdr:manufacturer'] || deviceInfo.manufacturer) {
        return {
          deviceName: deviceInfo['ufdr:model'] || deviceInfo.model || 'Unknown Device',
          deviceType: 'smartphone',
          imei: deviceInfo['ufdr:imei'] || deviceInfo.imei || null,
          phoneNumber: null,
          ownerName: null,
          manufacturer: deviceInfo['ufdr:manufacturer'] || deviceInfo.manufacturer || 'Unknown',
          model: deviceInfo['ufdr:model'] || deviceInfo.model || 'Unknown Model',
          osVersion: deviceInfo['ufdr:os'] || deviceInfo.os || deviceInfo['ufdr:osVersion'] || deviceInfo.osVersion || null,
          extractionDate: deviceInfo['ufdr:extractionDate'] || deviceInfo.extractionDate || new Date()
        };
      }

      // Handle different XML structures
      const project = parsedData.project || parsedData.root?.project || parsedData;
      const deviceAlt = project?.device || project?.Device || {};

      // If device is not directly available, try to extract from project attributes
      if (!deviceAlt.name && !deviceAlt.model && project) {
        return {
          deviceName: project.name || project['$']?.name || 'Unknown Device',
          deviceType: project.extractionType || 'smartphone',
          imei: null,
          phoneNumber: null,
          ownerName: null,
          manufacturer: 'Unknown',
          model: project.model || project['$']?.model || 'Unknown Model',
          osVersion: null,
          extractionDate: new Date()
        };
      }

      return {
        deviceName: deviceAlt.name || deviceAlt.model || project?.name || 'Unknown Device',
        deviceType: deviceAlt.type || project?.extractionType || 'smartphone',
        imei: deviceAlt.imei || deviceAlt.IMEI || null,
        phoneNumber: deviceAlt.phoneNumber || deviceAlt.msisdn || null,
        ownerName: deviceAlt.owner || deviceAlt.ownerName || null,
        manufacturer: deviceAlt.manufacturer || null,
        model: deviceAlt.model || project?.model || null,
        osVersion: deviceAlt.osVersion || deviceAlt.os || null,
        extractionDate: deviceAlt.extractionDate || new Date()
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
      const project = parsedData.project || root.project || root;

      // Debug logging
      logger.debug('Extracting data sources from:', {
        hasUFDR: !!parsedData['ufdr:UFDR'],
        hasProject: !!parsedData.project,
        hasRoot: !!parsedData.root,
        rootKeys: Object.keys(root || {}),
        projectKeys: Object.keys(project || {}),
        projectAttributes: project && project['$'] ? Object.keys(project['$']) : []
      });

      // Handle UFDR XML structure first
      const ufdr = parsedData['ufdr:UFDR'] || parsedData.UFDR || parsedData;
      if (ufdr['ufdr:device'] || ufdr.device) {
        logger.info('Detected UFDR XML structure, extracting from ufdr:device');
        return this.extractCellebriteDataSources(ufdr);
      }

      // Handle UFDR Network Traffic structure
      if (ufdr['ufdr:network'] || ufdr.network) {
        logger.info('Detected UFDR Network Traffic structure, extracting from ufdr:network');
        return this.extractNetworkDataSources(ufdr);
      }

      // Handle Cellebrite XML structure - check multiple ways
      const isCellebrite = project && project['$'] && (
        project['$']['xmlns:ufdr'] ||
        project['$']['xmlns'] ||
        project['$']['xmlns:dc']
      );

      if (isCellebrite) {
        logger.info('Detected Cellebrite XML structure, using extraction method');
        return this.extractCellebriteDataSources(project);
      }

      // Original structure for backward compatibility
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

      // If no sources found, return empty array
      if (sources.length === 0) {
        logger.warn('No data sources found in the parsed file');
      }

      return sources;
    } catch (error) {
      logger.error('Error extracting data sources:', error);
      return [];
    }
  }

  /**
   * Extract data sources from Cellebrite XML
   */
  extractCellebriteDataSources(project) {
    const sources = [];

    try {
      // Parse the actual UFDR XML structure
      logger.info('Parsing actual UFDR XML structure');

      // Get the device communications
      const device = project['ufdr:device'] || project.device || {};
      const communications = device['ufdr:communications'] || device.communications || {};

      // Extract SMS messages
      if (communications['ufdr:smsMessages'] || communications.smsMessages) {
        const smsMessages = communications['ufdr:smsMessages'] || communications.smsMessages;
        const smsData = this.extractSMSFromUFDR(smsMessages);
        if (smsData.length > 0) {
          sources.push({
            sourceType: 'sms',
            appName: 'Messages',
            data: smsData,
            totalRecords: smsData.length
          });
        }
      }

      // Extract Call Logs
      if (communications['ufdr:callLogs'] || communications.callLogs) {
        const callLogs = communications['ufdr:callLogs'] || communications.callLogs;
        const callData = this.extractCallsFromUFDR(callLogs);
        if (callData.length > 0) {
          sources.push({
            sourceType: 'call_log',
            appName: 'Phone',
            data: callData,
            totalRecords: callData.length
          });
        }
      }

      // Extract Emails
      if (communications['ufdr:emails'] || communications.emails) {
        const emails = communications['ufdr:emails'] || communications.emails;
        const emailData = this.extractEmailsFromUFDR(emails);
        if (emailData.length > 0) {
          sources.push({
            sourceType: 'email',
            appName: 'Mail',
            data: emailData,
            totalRecords: emailData.length
          });
        }
      }

      // If no sources found from actual parsing, return empty array
      if (sources.length === 0) {
        logger.warn('No data sources found in UFDR XML structure');
      }

      logger.info(`Extracted ${sources.length} data sources from UFDR XML`);
      return sources;

    } catch (error) {
      logger.error('Error extracting Cellebrite data sources:', error);
      return [];
    }
  }

  /**
   * Extract email messages from UFDR XML
   */
  extractEmailsFromUFDR(emails) {
    const emailMessages = [];

    try {
      // Handle both single email and array of emails
      const emailArray = this.normalizeArray(emails.email || emails);

      for (let i = 0; i < emailArray.length; i++) {
        const email = emailArray[i];

        emailMessages.push({
          id: email.id || `email_${i}`,
          type: 'email',
          sender: email.from || email.sender,
          recipient: email.to || email.recipient,
          subject: email.subject || '',
          content: email.body || email.content || '',
          timestamp: email.timestamp || new Date(),
          hasAttachments: email.hasAttachments === 'true' || false,
          attachmentCount: parseInt(email.attachmentCount) || 0
        });
      }

      logger.info(`Extracted ${emailMessages.length} email messages from UFDR XML`);
      return emailMessages;

    } catch (error) {
      logger.error('Error extracting emails from UFDR:', error);
      return [];
    }
  }

  /**
   * Parse SMS/Messages
   */
  parseMessages(messages) {
    const messageArray = this.normalizeArray(messages);
    return messageArray.map((msg, index) => {
      const message = {
        id: msg.id || `msg_${index}`,
        type: msg.type || 'sms',
        direction: msg.direction || (msg.type === 'sent' ? 'outgoing' : 'incoming'),
        phoneNumber: msg.address || msg.phoneNumber || msg.number,
        content: msg.body || msg.text || msg.content,
        timestamp: msg.date || msg.timestamp || new Date(),
        read: msg.read === 'true' || msg.read === true,
        threadId: msg.threadId || null
      };
      this.logRawMessage(message);
      return message;
    });
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
    return msgArray.map((msg, index) => {
      const message = {
        id: msg.id || `wa_${index}`,
        chatId: msg.chatId || msg.jid,
        sender: msg.sender || msg.from,
        content: msg.message || msg.text || msg.content,
        timestamp: msg.timestamp || msg.date || new Date(),
        mediaType: msg.mediaType || msg.type || 'text',
        mediaPath: msg.mediaPath || msg.media || null,
        isGroup: msg.isGroup === 'true' || msg.isGroup === true
      };
      this.logRawMessage(message);
      return message;
    });
  }

  /**
   * Parse Telegram messages
   */
  parseTelegram(telegram) {
    const msgArray = this.normalizeArray(telegram);
    return msgArray.map((msg, index) => {
      const message = {
        id: msg.id || `tg_${index}`,
        chatId: msg.chatId,
        sender: msg.sender || msg.from,
        content: msg.message || msg.text || msg.content,
        timestamp: msg.timestamp || msg.date || new Date(),
        mediaType: msg.mediaType || msg.type || 'text',
        mediaPath: msg.mediaPath || msg.media || null
      };
      this.logRawMessage(message);
      return message;
    });
  }

  /**
   * Extract SMS messages from UFDR XML
   */
  extractSMSFromUFDR(smsMessages) {
    const messages = [];

    try {
      // Handle the UFDR structure: smsMessages['ufdr:message'] is an array
      const messageArray = this.normalizeArray(smsMessages['ufdr:message'] || smsMessages.message || smsMessages);

      for (let i = 0; i < messageArray.length; i++) {
        const msg = messageArray[i];

        const message = {
          id: msg['ufdr:id'] || msg.id || `sms_${i}`,
          type: 'sms',
          direction: msg['ufdr:direction'] || msg.direction || 'incoming',
          phoneNumber: msg['ufdr:sender'] || msg['ufdr:recipient'] || msg.sender || msg.recipient || msg.address,
          content: msg['ufdr:body'] || msg.body || msg.content || msg.text,
          timestamp: msg['ufdr:timestamp'] || msg.timestamp || new Date(),
          read: (msg['ufdr:status'] || msg.status) === 'read' || false
        };
        this.logRawMessage(message);
        messages.push(message);
      }

      logger.info(`Extracted ${messages.length} SMS messages from UFDR XML`);
      return messages;

    } catch (error) {
      logger.error('Error extracting SMS from UFDR:', error);
      return [];
    }
  }

  /**
   * Extract call logs from UFDR XML
   */
  extractCallsFromUFDR(callLogs) {
    const calls = [];

    try {
      // Handle the UFDR structure: callLogs['ufdr:call'] is an array
      const callArray = this.normalizeArray(callLogs['ufdr:call'] || callLogs.call || callLogs);

      for (let i = 0; i < callArray.length; i++) {
        const call = callArray[i];

        calls.push({
          id: call['ufdr:id'] || call.id || `call_${i}`,
          type: call['ufdr:type'] || call.type || 'voice',
          direction: call['ufdr:direction'] || call.direction || 'incoming',
          phoneNumber: call['ufdr:number'] || call.number || call.phoneNumber,
          duration: parseInt(call['ufdr:duration'] || call.duration) || 0,
          timestamp: call['ufdr:timestamp'] || call.timestamp || new Date(),
          name: call['ufdr:name'] || call.name || call.contactName
        });
      }

      logger.info(`Extracted ${calls.length} call logs from UFDR XML`);
      return calls;

    } catch (error) {
      logger.error('Error extracting calls from UFDR:', error);
      return [];
    }
  }

  /**
   * Extract data sources from UFDR Network Traffic
   */
  extractNetworkDataSources(ufdr) {
    const sources = [];
    try {
      const network = ufdr['ufdr:network'] || ufdr.network || {};
      
      // 1. HTTP Requests
      if (network['ufdr:http'] || network.http) {
        const http = network['ufdr:http'] || network.http;
        const requestsContainer = http['ufdr:requests'] || http.requests || http;
        const requests = this.normalizeArray(requestsContainer['ufdr:request'] || requestsContainer.request || []);
        
        if (requests.length > 0) {
          sources.push({
            sourceType: 'http',
            appName: 'Web Browser',
            data: requests.map((req, i) => ({
              id: req['ufdr:id'] || req.id || `http_${i}`,
              url: req['ufdr:url'] || req.url || '',
              method: req['ufdr:method'] || req.method || 'GET',
              timestamp: req['ufdr:timestamp'] || req.timestamp || new Date(),
              userAgent: req['ufdr:userAgent'] || req.userAgent || ''
            })),
            totalRecords: requests.length
          });
        }
      }

      // 2. DNS Queries
      if (network['ufdr:dns'] || network.dns) {
          const dns = network['ufdr:dns'] || network.dns;
          const dnsContainer = dns['ufdr:queries'] || dns.queries || dns;
          const queries = this.normalizeArray(dnsContainer['ufdr:query'] || dnsContainer.query || []);
          if (queries.length > 0) {
              sources.push({
                  sourceType: 'dns',
                  appName: 'Network',
                  data: queries.map((q, i) => ({
                      id: q['ufdr:id'] || q.id || `dns_${i}`,
                      name: q['ufdr:name'] || q.name || q.query || '',
                      type: q['ufdr:type'] || q.type || 'A',
                      timestamp: q['ufdr:timestamp'] || q.timestamp || new Date()
                  })),
                  totalRecords: queries.length
              });
          }
      }

      // 3. SSL Sessions
      if (network['ufdr:ssl'] || network.ssl) {
          const ssl = network['ufdr:ssl'] || network.ssl;
          const sslContainer = ssl['ufdr:sessions'] || ssl.sessions || ssl;
          const sessions = this.normalizeArray(sslContainer['ufdr:session'] || sslContainer.session || []);
          if (sessions.length > 0) {
              sources.push({
                  sourceType: 'network_session',
                  appName: 'SSL/TLS',
                  data: sessions.map((s, i) => ({
                      id: s['ufdr:id'] || s.id || `ssl_${i}`,
                      host: s['ufdr:host'] || s.host || s.serverName || '',
                      protocol: s['ufdr:protocol'] || s.protocol || 'TLS',
                      timestamp: s['ufdr:timestamp'] || s.timestamp || new Date()
                  })),
                  totalRecords: sessions.length
              });
          }
      }

      return sources;
    } catch (error) {
      logger.error('Error extracting Network data sources:', error);
      return [];
    }
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
