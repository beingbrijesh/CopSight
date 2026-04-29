import fs from 'fs';
import JSONStream from 'JSONStream';
import sax from 'sax';
import { EventEmitter } from 'events';
import logger from '../../config/logger.js';

/**
 * Creates a streaming XML parser using SAX.
 * Emits 'record' for each message or contact found.
 */
export function createXmlParser(filePath) {
  const emitter = new EventEmitter();
  const readable = fs.createReadStream(filePath);
  const saxStream = sax.createStream(true, { trim: true });

  let currentTag = null;
  let currentRecord = null;
  let isInsideRecord = false;

  saxStream.on('opentag', (node) => {
    // Forensic XMLs often have <Message>, <Contact>, etc.
    const tagName = node.name.toLowerCase();
    if (tagName === 'message' || tagName === 'contact' || tagName === 'event') {
      isInsideRecord = true;
      currentRecord = { ...node.attributes };
    }
    currentTag = tagName;
  });

  saxStream.on('text', (text) => {
    if (isInsideRecord && currentRecord && currentTag) {
      currentRecord[currentTag] = (currentRecord[currentTag] || '') + text;
    }
  });

  saxStream.on('closetag', (tagName) => {
    const closedTag = tagName.toLowerCase();
    if (closedTag === 'message' || closedTag === 'contact' || closedTag === 'event') {
      emitter.emit('record', currentRecord);
      currentRecord = null;
      isInsideRecord = false;
    }
    currentTag = null;
  });

  saxStream.on('error', (err) => emitter.emit('error', err));
  saxStream.on('end', () => emitter.emit('result', { success: true }));

  readable.pipe(saxStream);
  return emitter;
}

/**
 * Creates a streaming JSON parser using JSONStream.
 * Emits 'record' for each item in the specified path.
 */
export function createJsonParser(filePath) {
  const emitter = new EventEmitter();
  const readable = fs.createReadStream(filePath);
  
  // Customise the path based on typical forensic JSON structure (e.g., 'records.*')
  const jsonStream = JSONStream.parse('records.*');

  jsonStream.on('data', (record) => {
    emitter.emit('record', record);
  });

  jsonStream.on('error', (err) => emitter.emit('error', err));
  jsonStream.on('end', () => emitter.emit('result', { success: true }));

  readable.pipe(jsonStream);
  return emitter;
}
