import React, { useEffect } from 'react';
import { Smartphone, HardDrive, RefreshCw, ShieldAlert, CheckCircle2, Usb } from 'lucide-react';
import { TargetDevice, useDaemonStore } from '../store/daemonStore';
import { daemonClient } from '../lib/daemonClient';

export const DeviceRadar: React.FC = () => {
  const { detectedDevices, selectedDevice, setSelectedDevice, isScanning } = useDaemonStore();

  useEffect(() => {
    daemonClient.scanDevices();
    const interval = setInterval(() => daemonClient.scanDevices(), 6000);
    return () => clearInterval(interval);
  }, []);

  const handleDeviceClick = (device: TargetDevice) => {
    setSelectedDevice(device);
  };

  return (
    <div className="glass-panel rounded-[2rem] p-6 h-full flex flex-col justify-between overflow-hidden relative">
      {/* Top Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white shadow-sm">
            <Usb className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-light tracking-wide text-white">Device Radar</h2>
            <p className="text-[10px] uppercase tracking-wider opacity-70">Hardware Bus Scanner</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-black/20 dark:bg-white/10 text-white font-semibold border border-white/10">
            {detectedDevices.length} Linked
          </span>
          <button
            onClick={() => daemonClient.scanDevices()}
            disabled={isScanning}
            className="p-2.5 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/30 dark:hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50 text-white"
            title="Scan USB Hardware Bus"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-[#FF7A59] dark:text-white' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Radar Visualizer & Hardware List */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center min-h-0">
        
        {/* Radar Graphic Canvas */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center relative py-2">
          <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full border border-white/20 relative flex items-center justify-center bg-black/30 dark:bg-black/50 overflow-hidden shadow-inner">
            {/* Concentric Rings */}
            <div className="absolute w-28 h-28 rounded-full border border-white/15" />
            <div className="absolute w-20 h-20 rounded-full border border-white/15" />
            <div className="absolute w-10 h-10 rounded-full border border-white/20" />

            {/* Crosshairs */}
            <div className="absolute w-full h-px bg-white/15" />
            <div className="absolute h-full w-px bg-white/15" />

            {/* Continuous Rotating Radar Sweep Cone */}
            <div className="absolute inset-0 radar-sweep-cone pointer-events-none rounded-full" />

            {/* Center Pulsing Dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF7A59] dark:bg-white shadow-[0_0_12px_rgba(255,122,89,0.9)] z-10 animate-ping" />
            <div className="w-2 h-2 rounded-full bg-[#FF7A59] dark:bg-white z-10" />

            {/* Dynamic Target Blips */}
            {detectedDevices.map((d, index) => {
              const isSelected = selectedDevice?.device_id === d.device_id;
              const angle = (index * 85 + 35) * (Math.PI / 180);
              const distance = 35 + (index % 2) * 15;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;

              return (
                <button
                  key={d.device_id}
                  onClick={() => handleDeviceClick(d)}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  className={`absolute z-20 cursor-pointer p-1.5 rounded-full transition-transform hover:scale-125 ${
                    isSelected
                      ? 'bg-[#FF7A59] dark:bg-white ring-4 ring-[#FF7A59]/40 shadow-[0_0_12px_#FF7A59]'
                      : 'bg-white/80 ring-2 ring-white/30'
                  }`}
                  title={`${d.platform.toUpperCase()} (${(d as any).model || d.device_id})`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-black" />
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-center">
            <span className="text-[10px] font-mono opacity-80 uppercase tracking-widest flex items-center gap-1.5 justify-center">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {isScanning ? 'Scanning Bus...' : 'Radar Active'}
            </span>
          </div>
        </div>

        {/* Connected Device Selection / Status List */}
        <div className="sm:col-span-7 flex flex-col justify-center space-y-2 h-full overflow-y-auto pr-1">
          {detectedDevices.length === 0 ? (
            <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 text-center space-y-2">
              <ShieldAlert className="w-7 h-7 text-[#FF7A59] dark:text-white/70 mx-auto" />
              <p className="text-xs font-semibold text-white">No Mobile Device Detected</p>
              <ul className="text-[10px] font-mono opacity-80 text-left space-y-1 bg-black/20 p-2.5 rounded-xl border border-white/5">
                <li>• Connect phone via USB data cable</li>
                <li>• Unlock screen & select <strong>"Trust"</strong> (iOS)</li>
                <li>• Enable <strong>USB Debugging</strong> (Android)</li>
              </ul>
            </div>
          ) : (
            detectedDevices.map((device) => {
              const isSelected = selectedDevice?.device_id === device.device_id;
              const isIos = device.platform.toLowerCase() === 'ios';
              const modelName = (device as any).model || `${device.platform} Target`;

              return (
                <div
                  key={device.device_id}
                  onClick={() => handleDeviceClick(device)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#FF7A59]/20 dark:bg-white/15 border-[#FF7A59] dark:border-white shadow-md ring-1 ring-[#FF7A59]/50'
                      : 'bg-black/15 dark:bg-white/5 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-[#FF7A59] text-white dark:bg-white dark:text-black' : 'bg-white/10 text-white'}`}>
                        {isIos ? <Smartphone className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white tracking-wide">
                            {modelName}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Ready
                          </span>
                        </div>
                        <p className="text-[10px] font-mono opacity-70 truncate max-w-[150px]">
                          SN: {device.serial || device.device_id}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FF7A59] text-white dark:bg-white dark:text-black">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
