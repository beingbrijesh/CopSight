import fs from 'fs/promises';

/**
 * Detects the file format (XML or JSON) by reading the first 1KB of the file.
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - 'xml', 'json', or 'unknown'
 */
export async function detectFileFormat(filePath) {
  let fileHandle;
  try {
    fileHandle = await fs.open(filePath, 'r');
    const { buffer } = await fileHandle.read(Buffer.alloc(1024), 0, 1024, 0);
    const content = buffer.toString('utf8').trim();

    if (content.startsWith('<?xml') || content.startsWith('<')) {
      return 'xml';
    }
    
    if (content.startsWith('{') || content.startsWith('[')) {
      return 'json';
    }

    return 'unknown';
  } catch (error) {
    console.error('Format detection error:', error);
    return 'unknown';
  } finally {
    if (fileHandle) await fileHandle.close();
  }
}
