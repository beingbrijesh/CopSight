/**
 * Cloudflare R2 Cloud Storage Service
 *
 * Uses the S3-compatible API provided by Cloudflare R2.
 * All forensic uploads are stored here instead of the ephemeral Render disk.
 *
 * Required env vars:
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

class CloudStorage {
  constructor() {
    this.client = null;
    this.bucketName = process.env.R2_BUCKET_NAME || '';
    this.isConfigured = false;

    if (
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      this.bucketName
    ) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });
      this.isConfigured = true;
      logger.info(`☁️  Cloudflare R2 storage initialized (bucket: ${this.bucketName})`);
    } else {
      logger.warn('☁️  Cloudflare R2 not configured — falling back to local disk storage');
    }
  }

  /**
   * Upload a local file to R2.
   * @param {string} localPath - Absolute path on disk.
   * @param {string} r2Key     - Object key inside the bucket (e.g. "cases/42/report.xml").
   * @returns {Promise<string>} The R2 object key.
   */
  async uploadFile(localPath, r2Key) {
    if (!this.isConfigured) {
      logger.debug('[CloudStorage] R2 not configured, skipping upload');
      return localPath; // Return local path as fallback
    }

    const fileStream = fs.createReadStream(localPath);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: r2Key,
      Body: fileStream,
    });

    await this.client.send(command);
    logger.info(`[CloudStorage] Uploaded ${path.basename(localPath)} → r2://${this.bucketName}/${r2Key}`);
    return r2Key;
  }

  /**
   * Upload raw bytes/buffer to R2.
   * @param {Buffer} buffer
   * @param {string} r2Key
   * @param {string} [contentType]
   * @returns {Promise<string>}
   */
  async uploadBuffer(buffer, r2Key, contentType = 'application/octet-stream') {
    if (!this.isConfigured) return r2Key;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);
    logger.info(`[CloudStorage] Uploaded buffer → r2://${this.bucketName}/${r2Key}`);
    return r2Key;
  }

  /**
   * Download an R2 object to a local temporary file.
   * @param {string} r2Key
   * @param {string} localPath - Where to save the file.
   * @returns {Promise<string>} The local path.
   */
  async downloadFile(r2Key, localPath) {
    if (!this.isConfigured) {
      logger.warn('[CloudStorage] R2 not configured, cannot download');
      return localPath;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: r2Key,
    });

    const response = await this.client.send(command);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(localPath);
    await new Promise((resolve, reject) => {
      response.Body.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    logger.info(`[CloudStorage] Downloaded r2://${this.bucketName}/${r2Key} → ${localPath}`);
    return localPath;
  }

  /**
   * Generate a short-lived pre-signed URL for the frontend to access a private object.
   * @param {string} r2Key
   * @param {number} [expiresInSec=3600] - URL lifetime in seconds (default 1 hour).
   * @returns {Promise<string>}
   */
  async getPresignedUrl(r2Key, expiresInSec = 3600) {
    if (!this.isConfigured) return '';

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: r2Key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSec });
    return url;
  }

  /**
   * Delete an object from R2.
   * @param {string} r2Key
   */
  async deleteFile(r2Key) {
    if (!this.isConfigured) return;

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: r2Key,
    });

    await this.client.send(command);
    logger.info(`[CloudStorage] Deleted r2://${this.bucketName}/${r2Key}`);
  }
}

const cloudStorage = new CloudStorage();
export default cloudStorage;
