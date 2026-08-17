import { create } from 'zustand';

export interface TargetDevice {
  device_id: string;
  platform: 'android' | 'ios' | 'storage' | 'unknown' | string;
  vendor_id: string;
  product_id: string;
  serial?: string;
  model?: string;
  batteryLevel?: number;
  isTrusted?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
}

interface DaemonState {
  daemonUrl: string;
  isDaemonConnected: boolean;
  isUsbBackendReady: boolean;
  isScanning: boolean;
  detectedDevices: TargetDevice[];
  selectedDevice: TargetDevice | null;
  
  // Acquisition Runtime
  isAcquiring: boolean;
  extractionLevel: 'logical' | 'file_system' | 'physical';
  extractionProfile: 'textual' | 'media' | 'all' | 'deleted';
  outputDirectory: string;
  totalArtifactsExtracted: number;
  currentSpeedMbps: number;
  latestArtifactName: string;
  latestSha256: string;
  logs: LogEntry[];
  lastCompletedResult: any | null;

  // Actions
  setDaemonUrl: (url: string) => void;
  setDaemonConnected: (connected: boolean) => void;
  setUsbBackendReady: (ready: boolean) => void;
  setIsScanning: (scanning: boolean) => void;
  setDetectedDevices: (devices: TargetDevice[]) => void;
  setSelectedDevice: (device: TargetDevice | null) => void;
  setExtractionLevel: (level: 'logical' | 'file_system' | 'physical') => void;
  setExtractionProfile: (profile: 'textual' | 'media' | 'all' | 'deleted') => void;
  setOutputDirectory: (dir: string) => void;
  setIsAcquiring: (acquiring: boolean) => void;
  addLogMessage: (level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', message: string) => void;
  clearLogs: () => void;
  updateLiveMetrics: (data: { count?: number; speed?: number; name?: string; sha256?: string }) => void;
  setCompletedResult: (result: any) => void;
  resetAcquisitionState: () => void;
}

export const useDaemonStore = create<DaemonState>((set) => ({
  daemonUrl: 'http://127.0.0.1:54322',
  isDaemonConnected: false,
  isUsbBackendReady: true,
  isScanning: false,
  detectedDevices: [],
  selectedDevice: null,

  isAcquiring: false,
  extractionLevel: 'logical',
  extractionProfile: 'all',
  outputDirectory: './cases',
  totalArtifactsExtracted: 0,
  currentSpeedMbps: 0,
  latestArtifactName: '',
  latestSha256: '',
  logs: [],
  lastCompletedResult: null,

  setDaemonUrl: (daemonUrl) => set({ daemonUrl }),
  setDaemonConnected: (isDaemonConnected) => set({ isDaemonConnected }),
  setUsbBackendReady: (isUsbBackendReady) => set({ isUsbBackendReady }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),
  setDetectedDevices: (detectedDevices) =>
    set((state) => ({
      detectedDevices,
      selectedDevice:
        state.selectedDevice && detectedDevices.some((d) => d.device_id === state.selectedDevice?.device_id)
          ? state.selectedDevice
          : detectedDevices.length > 0
          ? detectedDevices[0]
          : null,
    })),
  setExtractionLevel: (extractionLevel) => set({ extractionLevel }),
  setExtractionProfile: (extractionProfile) => set({ extractionProfile }),
  setOutputDirectory: (outputDirectory) => set({ outputDirectory }),
  setIsAcquiring: (isAcquiring) => set({ isAcquiring }),

  addLogMessage: (level, message) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    set((state) => ({
      logs: [...state.logs.slice(-499), entry], // keep last 500 logs
    }));
  },

  clearLogs: () => set({ logs: [] }),

  updateLiveMetrics: ({ count, speed, name, sha256 }) => {
    set((state) => ({
      totalArtifactsExtracted: count !== undefined ? count : state.totalArtifactsExtracted,
      currentSpeedMbps: speed !== undefined ? speed : state.currentSpeedMbps,
      latestArtifactName: name !== undefined ? name : state.latestArtifactName,
      latestSha256: sha256 !== undefined ? sha256 : state.latestSha256,
    }));
  },

  setCompletedResult: (lastCompletedResult) => set({ lastCompletedResult }),

  resetAcquisitionState: () =>
    set({
      isAcquiring: false,
      totalArtifactsExtracted: 0,
      currentSpeedMbps: 0,
      latestArtifactName: '',
      latestSha256: '',
    }),
}));
