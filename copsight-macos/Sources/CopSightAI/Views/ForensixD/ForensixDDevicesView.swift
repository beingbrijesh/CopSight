import SwiftUI

struct ForensixDDevicesView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var connectedCount = 1
    @State private var selectedPartition = "disk0s1s2"
    
    struct PartitionItem: Identifiable {
        let id: String
        let name: String
        let mountPoint: String
        let fileSystem: String
        let size: String
        let usedPercent: Double
        let status: String
        let isEncrypted: Bool
    }
    
    let partitions: [PartitionItem] = [
        PartitionItem(id: "disk0s1s1", name: "System Volume (RootFS)", mountPoint: "/", fileSystem: "APFS (Sealed)", size: "9.8 GB", usedPercent: 0.95, status: "Read-Only / Sealed", isEncrypted: false),
        PartitionItem(id: "disk0s1s2", name: "User Data Partition", mountPoint: "/private/var", fileSystem: "APFS (Encrypted)", size: "214.2 GB / 256 GB", usedPercent: 0.84, status: "Target for Acquisition", isEncrypted: true),
        PartitionItem(id: "disk0s1s3", name: "Preboot & Secure Enclave", mountPoint: "/private/preboot", fileSystem: "APFS", size: "420 MB", usedPercent: 0.35, status: "Keybag Present", isEncrypted: true),
        PartitionItem(id: "disk0s1s4", name: "RecoveryOS Subsystem", mountPoint: "/private/recovery", fileSystem: "APFS", size: "1.8 GB", usedPercent: 0.60, status: "Verified Digest", isEncrypted: false)
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GeometryReader { geo in
            let isStacked = geo.size.width < 1050
            
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    
                    // Header
                    HStack(alignment: .center) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("USB Hardware & Device Center")
                                .font(.system(size: 28, weight: .light))
                                .foregroundColor(.white)
                            Text("Real-time USB bus controller interrogation, physical topology mapping and partition geometry")
                                .font(.system(size: 11.5))
                                .foregroundColor(.white.opacity(0.85))
                        }
                        Spacer()
                        
                        HStack(spacing: 10) {
                            HStack(spacing: 6) {
                                Circle().fill(CopSightTheme.emerald).frame(width: 7, height: 7)
                                Text("IOKit Daemon 127.0.0.1:54322")
                                    .font(.system(size: 10.5, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.9))
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(100)
                            
                            Text("\(connectedCount) Device Linked")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                                .background(theme.primaryAccent(isDark: isDark))
                                .foregroundColor(theme.primaryAccentText(isDark: isDark))
                                .cornerRadius(100)
                        }
                    }
                    
                    // Top Row: Device Radar + Hardware Diagnostics (Responsive stack)
                    if isStacked {
                        VStack(spacing: 20) {
                            DeviceRadarView()
                                .frame(maxWidth: .infinity)
                            
                            diagnosticsCard
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        HStack(alignment: .top, spacing: 18) {
                            DeviceRadarView()
                                .frame(maxWidth: .infinity)
                            
                            diagnosticsCard
                                .frame(maxWidth: .infinity, maxHeight: 500)
                        }
                    }
                    
                    // Bottom Row 1: Target Device Partition Table & Storage Geometry Explorer
                    GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Circle()
                                    .fill(theme.iconCircleBg(isDark: isDark))
                                    .frame(width: 38, height: 38)
                                    .overlay(
                                        Image(systemName: "internaldrive.fill")
                                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                                            .font(.system(size: 16))
                                    )
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Connected Target Partition Table & File System Geometry")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("PHYSICAL FLASH MEMORY PARTITION MAP (NVMe / UFS 4.0)")
                                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                        .tracking(1)
                                        .foregroundColor(.white.opacity(0.75))
                                }
                                
                                Spacer()
                                
                                HStack(spacing: 8) {
                                    Button(action: {}) {
                                        HStack(spacing: 6) {
                                            Image(systemName: "key.fill")
                                            Text("Inspect Keybag")
                                        }
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 7)
                                        .background(theme.primaryAccent(isDark: isDark))
                                        .cornerRadius(100)
                                    }
                                    .buttonStyle(.plain)
                                    .focusable(false)
                                    .focusEffectDisabled()
                                    
                                    Button(action: {}) {
                                        HStack(spacing: 6) {
                                            Image(systemName: "arrow.triangle.2.circlepath")
                                            Text("Refresh Sectors")
                                        }
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 7)
                                        .background(theme.insetFill(isDark: isDark))
                                        .cornerRadius(100)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 100)
                                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .focusable(false)
                                    .focusEffectDisabled()
                                }
                            }
                            
                            // Partition Rows Table
                            VStack(spacing: 8) {
                                ForEach(partitions) { part in
                                    let isSelected = selectedPartition == part.id
                                    Button(action: { selectedPartition = part.id }) {
                                        HStack(spacing: 14) {
                                            HStack(spacing: 8) {
                                                Image(systemName: part.isEncrypted ? "lock.fill" : "lock.open.fill")
                                                    .font(.system(size: 13))
                                                    .foregroundColor(part.isEncrypted ? CopSightTheme.amber : CopSightTheme.emerald)
                                                
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(part.name)
                                                        .font(.system(size: 13, weight: .bold))
                                                        .foregroundColor(.white)
                                                    Text("\(part.id) • \(part.mountPoint)")
                                                        .font(.system(size: 10, design: .monospaced))
                                                        .foregroundColor(.white.opacity(0.7))
                                                }
                                            }
                                            .frame(width: 240, alignment: .leading)
                                            
                                            // File system tag
                                            Text(part.fileSystem)
                                                .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 3)
                                                .background(Color.white.opacity(0.08))
                                                .foregroundColor(.white.opacity(0.85))
                                                .cornerRadius(6)
                                            
                                            Spacer()
                                            
                                            // Usage bar
                                            VStack(alignment: .trailing, spacing: 3) {
                                                HStack(spacing: 6) {
                                                    Text(part.size)
                                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                                        .foregroundColor(.white)
                                                    Text(String(format: "%.0f%%", part.usedPercent * 100))
                                                        .font(.system(size: 9.5, design: .monospaced))
                                                        .foregroundColor(.white.opacity(0.6))
                                                }
                                                
                                                GeometryReader { barGeo in
                                                    ZStack(alignment: .leading) {
                                                        RoundedRectangle(cornerRadius: 3)
                                                            .fill(Color.white.opacity(0.12))
                                                            .frame(height: 5)
                                                        RoundedRectangle(cornerRadius: 3)
                                                            .fill(part.isEncrypted ? CopSightTheme.coral : CopSightTheme.emerald)
                                                            .frame(width: barGeo.size.width * part.usedPercent, height: 5)
                                                    }
                                                }
                                                .frame(width: 120, height: 5)
                                            }
                                            
                                            Text(part.status)
                                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 4)
                                                .background(isSelected ? theme.primaryAccent(isDark: isDark).opacity(0.25) : Color.white.opacity(0.08))
                                                .foregroundColor(isSelected ? theme.primaryAccent(isDark: isDark) : .white.opacity(0.85))
                                                .cornerRadius(100)
                                        }
                                        .padding(12)
                                        .background(isSelected
                                            ? (isDark ? Color.white.opacity(0.14) : CopSightTheme.coral.opacity(0.18))
                                            : theme.insetFill(isDark: isDark)
                                        )
                                        .cornerRadius(CopSightTheme.innerRadius)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                                                .strokeBorder(isSelected ? theme.primaryAccent(isDark: isDark) : theme.insetBorder(isDark: isDark), lineWidth: 1)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(20)
                    }
                    
                    // Bottom Row 2: USB Controller Hub & Physical Bus Topology Map
                    GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Circle()
                                    .fill(theme.iconCircleBg(isDark: isDark))
                                    .frame(width: 38, height: 38)
                                    .overlay(
                                        Image(systemName: "cable.connector.horizontal")
                                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                                            .font(.system(size: 16))
                                    )
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Host Controller Physical USB Topology")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("ROOT HUB BUS SPEED, POWER DELIVERY & ENDPOINT DESCRIPTORS")
                                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                        .tracking(1)
                                        .foregroundColor(.white.opacity(0.75))
                                }
                                
                                Spacer()
                            }
                            
                            if isStacked {
                                LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: 14)], spacing: 14) {
                                    TopologyNodeCard(icon: "laptopcomputer", title: "Apple USB 3.2 Host Hub", subtitle: "Bus 0x02 • SuperSpeed+ 10Gbps", status: "Online", statusColor: CopSightTheme.emerald)
                                    TopologyNodeCard(icon: "iphone", title: "Apple iPhone 15 Pro Max", subtitle: "Port 1 • 5V/3.0A • DFU/Normal", status: "Linked", statusColor: CopSightTheme.emerald)
                                    TopologyNodeCard(icon: "shield.lefthalf.filled", title: "Hardware Write-Blocker", subtitle: "Port 2 • Hardware Lock Active", status: "Protected", statusColor: CopSightTheme.cyan)
                                    TopologyNodeCard(icon: "key.horizontal.fill", title: "FIPS Hardware Token", subtitle: "Port 3 • YubiKey HSM Module", status: "Verified", statusColor: CopSightTheme.amber)
                                }
                            } else {
                                HStack(spacing: 14) {
                                    TopologyNodeCard(icon: "laptopcomputer", title: "Apple USB 3.2 Host Hub", subtitle: "Bus 0x02 • SuperSpeed+ 10Gbps", status: "Online", statusColor: CopSightTheme.emerald)
                                    TopologyNodeCard(icon: "iphone", title: "Apple iPhone 15 Pro Max", subtitle: "Port 1 • 5V/3.0A • DFU/Normal", status: "Linked", statusColor: CopSightTheme.emerald)
                                    TopologyNodeCard(icon: "shield.lefthalf.filled", title: "Hardware Write-Blocker", subtitle: "Port 2 • Hardware Lock Active", status: "Protected", statusColor: CopSightTheme.cyan)
                                    TopologyNodeCard(icon: "key.horizontal.fill", title: "FIPS Hardware Token", subtitle: "Port 3 • YubiKey HSM Module", status: "Verified", statusColor: CopSightTheme.amber)
                                }
                            }
                        }
                        .padding(20)
                    }
                }
                .padding(.horizontal, 2)
                .padding(.bottom, 60)
                .thinScrollable()
            }
            .scrollIndicators(.hidden)
        }
    }
    
    private var diagnosticsCard: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 38, height: 38)
                        .overlay(
                            Image(systemName: "cpu.fill")
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 16))
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Hardware Diagnostic Parameters")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                        Text("LOW-LEVEL KERNEL & CONTROLLER SUBSYSTEMS")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.75))
                    }
                    
                    Spacer()
                }
                
                VStack(spacing: 7) {
                    DiagnosticRow(label: "Daemon RPC Interface", value: "127.0.0.1:54322 (Active)", valueColor: CopSightTheme.emerald)
                    DiagnosticRow(label: "USB Host Controller Driver", value: "AppleUSBLib / libusb-1.0", valueColor: .white)
                    DiagnosticRow(label: "Android Debug Bridge (ADB)", value: "Auto-Handshake Enabled", valueColor: theme.primaryAccent(isDark: isDark))
                    DiagnosticRow(label: "Apple MobileDevice Framework", value: "Pairing Record Active", valueColor: CopSightTheme.cyan)
                }
                
                // Polling Footer
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(CopSightTheme.emerald)
                            .font(.system(size: 13))
                        Text("Continuous Hardware Polling")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(CopSightTheme.emerald)
                    }
                    Text("The USB bus is actively probed every 6 seconds to capture hot-plugged iOS (DFU/Recovery/Normal) and Android (EDL/Fastboot/ADB/MTP) targets.")
                        .font(.system(size: 10))
                        .lineSpacing(3)
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding(10)
                .background(theme.insetFill(isDark: isDark))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                )
            }
            .padding(18)
        }
    }
}

struct TopologyNodeCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let icon: String
    let title: String
    let subtitle: String
    let status: String
    let statusColor: Color
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Circle()
                    .fill(theme.iconCircleBg(isDark: isDark))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 14))
                            .foregroundColor(statusColor)
                    )
                Spacer()
                Text(status)
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusColor.opacity(0.2))
                    .foregroundColor(statusColor)
                    .cornerRadius(100)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.white.opacity(0.7))
                    .lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.insetFill(isDark: isDark))
        .cornerRadius(CopSightTheme.innerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
        )
    }
}

struct DiagnosticRow: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let label: String
    let value: String
    let valueColor: Color
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.white.opacity(0.8))
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundColor(valueColor)
        }
        .padding(9)
        .background(theme.insetFill(isDark: isDark))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
        )
    }
}
