import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { DateTime } from 'luxon';

/**
 * Normalizes a record (message, contact, or event).
 * @param {object} rawRecord - The raw object from the parser
 * @param {string} traceId - The unique ID for tracking this record
 * @returns {object} - The normalized object
 */
export function normalizeRecord(rawRecord, traceId) {
  const norm = {
    traceId,
    raw: rawRecord,
    processedAt: new Date().toISOString(),
    // Core fields
    content: (rawRecord.content || rawRecord.text || rawRecord.body || rawRecord.Message || '').trim(),
    timestamp: normalizeDate(rawRecord.timestamp || rawRecord.Date || rawRecord.Time || rawRecord.CreatedTime),
    sourceType: rawRecord.sourceType || rawRecord.Type || 'data_item',
    // Contact fields
    sender: normalizePhone(rawRecord.sender || rawRecord.From || rawRecord.Sender),
    receiver: normalizePhone(rawRecord.receiver || rawRecord.To || rawRecord.Recipient),
    // Metadata
    metadata: { ...rawRecord }
  };

  return norm;
}

/**
 * Normalizes phone numbers to E.164.
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const phoneNumber = parsePhoneNumberFromString(phone.toString(), 'IN'); // Default to India 'IN'
  return phoneNumber ? phoneNumber.format('E.164') : phone.toString();
}

/**
 * Normalizes dates to ISO-8601 string.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  // Try common forensic formats
  const dt = DateTime.fromISO(dateStr) 
    || DateTime.fromSQL(dateStr)
    || DateTime.fromHTTP(dateStr)
    || DateTime.fromFormat(dateStr, 'yyyy-MM-dd HH:mm:ss');

  return dt.isValid ? dt.toISO() : new Date().toISOString();
}
