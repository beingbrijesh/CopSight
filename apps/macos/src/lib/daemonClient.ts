import axios from 'axios';
import { useDaemonStore } from '../store/daemonStore';
import { getStreamBaseUrl } from './api';
import { loggerService } from './loggerService';

class DaemonClient {
  private baseUrl: string = 'http://127.0.0.1:54322';
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private pollInterval: any = null;
  private eventPollIndex: number = 0;
  private isIntentionallyClosed: boolean = false;
  private lastHealthState: boolean | null = null;

  public setBaseUrl(url: string) {
    this.baseUrl = url;
    loggerService.info('DAEMON', `Daemon base URL set to: ${url}`);
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.baseUrl}/health`, { timeout: 3000 });
      const isOk = res.data?.status === 'healthy';
      useDaemonStore.getState().setDaemonConnected(isOk);
      useDaemonStore.getState().setUsbBackendReady(res.data?.usb_available ?? true);
      if (this.lastHealthState !== isOk) {
        this.lastHealthState = isOk;
        if (isOk) {
          loggerService.event('DAEMON', 'Health Check', 'SUCCESS', 'Daemon engine is ONLINE (127.0.0.1:54322, USB Ready)', res.data);
        } else {
          loggerService.event('DAEMON', 'Health Check', 'FAILED', 'Daemon returned non-healthy status', res.data);
        }
      }
      return isOk;
    } catch (err: any) {
      useDaemonStore.getState().setDaemonConnected(false);
      if (this.lastHealthState !== false) {
        this.lastHealthState = false;
        loggerService.event('DAEMON', 'Health Check', 'FAILED', `Daemon is OFFLINE: ${err.message}`);
      }
      return false;
    }
  }

  public startPollingEvents() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
      }
      try {
        const res = await axios.get(`${this.baseUrl}/api/acquire/events/poll?since=${this.eventPollIndex}`, { timeout: 3000 });
        if (res.data?.success && Array.isArray(res.data.events)) {
          for (const ev of res.data.events) {
            this.handleEvent(ev);
          }
          this.eventPollIndex = res.data.next_idx ?? (this.eventPollIndex + res.data.events.length);
        }
      } catch {
        // Quietly ignore transient delay
      }
    }, 600);
  }

  public async scanDevices() {
    const store = useDaemonStore.getState();
    store.setIsScanning(true);
    loggerService.event('DEVICE', 'USB Bus Scan', 'INITIATED', 'Probing host USB controllers for connected forensic devices...');
    try {
      const res = await axios.get(`${this.baseUrl}/api/devices`, { timeout: 8000 });
      if (res.data?.success && Array.isArray(res.data.devices)) {
        store.setDetectedDevices(res.data.devices);
        store.setUsbBackendReady(res.data.usb_backend_ready ?? true);
        const deviceNames = res.data.devices.map((d: any) => `${d.model || 'Device'} (${d.platform})`).join(', ') || 'No devices attached';
        loggerService.event('DEVICE', 'USB Bus Scan', 'SUCCESS', `Discovered ${res.data.devices.length} device(s): ${deviceNames}`, {
          count: res.data.devices.length,
          devices: res.data.devices,
        });
      } else {
        store.setDetectedDevices([]);
        loggerService.event('DEVICE', 'USB Bus Scan', 'SUCCESS', 'Scan completed: 0 forensic targets detected.');
      }
    } catch (err: any) {
      loggerService.event('DEVICE', 'USB Bus Scan', 'FAILED', `USB scan error: ${err.message}`);
    } finally {
      store.setIsScanning(false);
    }
  }

  public async startAcquisition(params: {
    caseInfo: any;
    deviceId?: string;
    level: string;
    profile: string;
    outputDir: string;
    token?: string;
    sessionEncryptionKey?: string;
    streamUrl?: string;
  }) {
    const store = useDaemonStore.getState();
    store.setIsAcquiring(true);
    store.resetAcquisitionState();
    store.setIsAcquiring(true);
    store.addLogMessage('INFO', `Starting forensic extraction on case ${params.caseInfo.caseNumber}...`);
    
    loggerService.event('ACQUISITION', 'Start Extraction', 'INITIATED', `Case #${params.caseInfo.caseNumber} | Level=${params.level} | Profile=${params.profile} | Target=${params.deviceId || 'Default USB'}`, params);

    const streamUrl = params.streamUrl || getStreamBaseUrl();

    try {
      const res = await axios.post(`${this.baseUrl}/api/acquire/start`, {
        case_info: params.caseInfo,
        device_id: params.deviceId,
        level: params.level,
        profile: params.profile,
        output_dir: params.outputDir,
        token: params.token,
        session_encryption_key: params.sessionEncryptionKey,
        stream_url: streamUrl,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Failed to start acquisition');
      }
      loggerService.event('ACQUISITION', 'Start Extraction', 'SUCCESS', `Extraction job initiated with Session ID: ${res.data?.session_id || 'Active'}`, res.data);
      return res.data;
    } catch (err: any) {
      store.setIsAcquiring(false);
      store.addLogMessage('ERROR', `Acquisition initiation failed: ${err.message}`);
      loggerService.event('ACQUISITION', 'Start Extraction', 'FAILED', `Extraction initiation failed: ${err.message}`, { error: err });
      throw err;
    }
  }

  public async cancelAcquisition() {
    const store = useDaemonStore.getState();
    loggerService.event('ACQUISITION', 'Cancel Extraction', 'INITIATED', 'User requested immediate forensic session abort.');
    try {
      const res = await axios.post(`${this.baseUrl}/api/acquire/cancel`);
      store.addLogMessage('WARN', res.data?.message || 'Aborting acquisition...');
      loggerService.event('ACQUISITION', 'Cancel Extraction', 'SUCCESS', `Session aborted: ${res.data?.message || 'OK'}`);
      return res.data;
    } catch (err: any) {
      store.addLogMessage('ERROR', `Failed to cancel: ${err.message}`);
      loggerService.event('ACQUISITION', 'Cancel Extraction', 'FAILED', `Abort request failed: ${err.message}`);
    }
  }

  public connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/acquire/events';
    const store = useDaemonStore.getState();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isIntentionallyClosed) {
          this.ws?.close(1000);
          return;
        }
        store.setDaemonConnected(true);
        store.addLogMessage('SUCCESS', 'Connected to local CopSight Forensic Stream Engine.');
        loggerService.event('DAEMON', 'WebSocket Stream', 'SUCCESS', 'Real-time telemetry WebSocket connected.');
        
        // Start ping keep-alive
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          }
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch {
          // Non-JSON message
        }
      };

      this.ws.onclose = () => {
        clearInterval(this.pingInterval);
        if (!this.isIntentionallyClosed) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
        }
      };

      this.ws.onerror = () => {
        // WebSocket error should not invalidate HTTP REST connection
      };
    } catch (e) {
      // Ignore WebSocket transport error; HTTP health loop handles daemon connection state
    }
  }

  private handleEvent(data: any) {
    const store = useDaemonStore.getState();

    switch (data.type) {
      case 'ACQUISITION_INITIALIZING':
        store.addLogMessage('INFO', `Initializing extraction pipeline: Level=${data.level} Profile=${data.profile}`);
        loggerService.info('ACQUISITION', `Pipeline Initializing: Level=${data.level} Profile=${data.profile}`);
        break;

      case 'DEVICE_ACQUIRED':
        store.addLogMessage('SUCCESS', `Target locked: ${data.platform.toUpperCase()} (${data.device_id})`);
        loggerService.event('DEVICE', 'Target Lock', 'SUCCESS', `Target device secured: ${data.platform} (${data.device_id})`, data);
        break;

      case 'STREAM_CONNECTED':
        store.addLogMessage('SUCCESS', `E2EE Cloud streaming pipeline active -> ${data.streamUrl}`);
        loggerService.event('ACQUISITION', 'E2EE Stream Pipeline', 'SUCCESS', `Cloud streaming channel established.`);
        break;

      case 'SESSION_STARTED':
        store.addLogMessage('INFO', `Forensic session sealed. ID: ${data.sessionId}`);
        loggerService.event('ACQUISITION', 'Forensic Session', 'SUCCESS', `Session sealed cryptographically. ID: ${data.sessionId}`);
        break;

      case 'ARTIFACT_EXTRACTED':
        store.updateLiveMetrics({
          count: data.totalExtracted,
          speed: data.speedMbps,
          name: data.name,
          sha256: data.sha256,
        });
        store.addLogMessage(
          'INFO',
          `[+${data.category}] ${data.name} (${(data.fileSize / 1024).toFixed(1)} KB) - SHA: ${data.sha256}...`
        );
        break;

      case 'LOG_MESSAGE':
        store.addLogMessage(data.level || 'INFO', data.message);
        break;

      case 'ACQUISITION_COMPLETED':
        store.setIsAcquiring(false);
        store.setCompletedResult(data);
        store.addLogMessage('SUCCESS', `Acquisition complete! Root SHA-256: ${data.rootHash}`);
        loggerService.event('ACQUISITION', 'Extraction Complete', 'SUCCESS', `Forensic extraction finished. Root Hash: ${data.rootHash}`, data);
        break;

      case 'ACQUISITION_ERROR':
        store.setIsAcquiring(false);
        store.addLogMessage('ERROR', `Extraction error: ${data.error}`);
        loggerService.event('ACQUISITION', 'Extraction Error', 'FAILED', `Extraction failed: ${data.error}`, data);
        break;
    }
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    clearInterval(this.pingInterval);
    clearInterval(this.pollInterval);
    this.pollInterval = null;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Component unmounted');
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        const pending = this.ws;
        pending.onopen = () => pending.close(1000, 'Component unmounted');
      }
      this.ws = null;
    }
  }
}

export const daemonClient = new DaemonClient();
