import SwiftUI

struct DeviceRadarView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var isScanning = false
    @State private var selectedDeviceId = "00008120-0004040G04000000"
    @State private var hoveredDeviceId: String? = nil
    
    struct DetectedDevice: Identifiable {
        let id: String
        let model: String
        let platform: String
        let serial: String
        let osVersion: String
        let busSpeed: String
        let pairingStatus: String
        let writeBlockStatus: String
        let isReady: Bool
    }
    
    @State private var devices: [DetectedDevice] = [
        DetectedDevice(
            id: "00008120-0004040G04000000",
            model: "Apple iPhone 15 Pro Max",
            platform: "iOS",
            serial: "SN: 00008120-0004040G04000000",
            osVersion: "iOS 17.5.1 (21F90)",
            busSpeed: "USB 3.2 SuperSpeed+ (10 Gbps)",
            pairingStatus: "Host Pairing Authorized",
            writeBlockStatus: "Hardware Lock Verified",
            isReady: true
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(spacing: 0) {
                // Top Header
                HStack(alignment: .center) {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(theme.iconCircleBg(isDark: isDark))
                            .frame(width: 38, height: 38)
                            .overlay(
                                Image(systemName: "cable.connector.horizontal")
                                    .font(.system(size: 16))
                                    .foregroundColor(theme.primaryAccent(isDark: isDark))
                            )
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Device Radar")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text("HARDWARE BUS SCANNER")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .tracking(1)
                                .foregroundColor(.white.opacity(0.75))
                        }
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 8) {
                        Text("\(devices.count) Linked")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(theme.insetFill(isDark: isDark))
                            .foregroundColor(.white)
                            .cornerRadius(100)
                            .overlay(
                                RoundedRectangle(cornerRadius: 100)
                                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                            )
                        
                        Button(action: {
                            isScanning = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                                isScanning = false
                            }
                        }) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(isScanning ? theme.primaryAccent(isDark: isDark) : .white)
                                .rotationEffect(.degrees(isScanning ? 360 : 0))
                                .animation(isScanning ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: isScanning)
                                .frame(width: 28, height: 28)
                                .background(theme.insetFill(isDark: isDark))
                                .clipShape(Circle())
                                .overlay(
                                    Circle().strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
                .padding(.bottom, 12)
                
                Divider().background(Color.white.opacity(0.12))
                
                // Body: High-Luminance Radar Canvas (Left) + Compact Device List & Hover Popover (Right)
                HStack(spacing: 16) {
                    // High-Luminance Radar Canvas
                    VStack(spacing: 10) {
                        ZStack {
                            // Dark Radar Disc Backing
                            Circle()
                                .fill(Color.black.opacity(isDark ? 0.70 : 0.45))
                                .frame(width: 150, height: 150)
                                .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1.5))
                            
                            // High-Contrast Concentric Rings
                            Circle().strokeBorder(Color.white.opacity(0.32), lineWidth: 1).frame(width: 115, height: 115)
                            Circle().strokeBorder(Color.white.opacity(0.32), lineWidth: 1).frame(width: 78, height: 78)
                            Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1).frame(width: 40, height: 40)
                            
                            // Reticle Crosshairs
                            Rectangle().fill(Color.white.opacity(0.28)).frame(width: 150, height: 1)
                            Rectangle().fill(Color.white.opacity(0.28)).frame(width: 1, height: 150)
                            
                            // High-Visibility Sweep Beam (80% Conic Gradient + Glowing Leading Edge)
                            TimelineView(.animation) { context in
                                Canvas { ctx, size in
                                    let angle = context.date.timeIntervalSinceReferenceDate * (2 * .pi / 2.8)
                                    let center = CGPoint(x: size.width / 2, y: size.height / 2)
                                    
                                    ctx.translateBy(x: center.x, y: center.y)
                                    ctx.rotate(by: .radians(angle))
                                    
                                    // Conic Phosphor Gradient Beam
                                    let path = Path { p in
                                        p.move(to: .zero)
                                        p.addArc(center: .zero, radius: 76, startAngle: .degrees(-75), endAngle: .degrees(0), clockwise: false)
                                        p.closeSubpath()
                                    }
                                    
                                    let beamColor = isDark ? Color(hex: "34d399") : CopSightTheme.coral
                                    let gradient = Gradient(colors: [
                                        beamColor.opacity(0.0),
                                        beamColor.opacity(0.30),
                                        beamColor.opacity(0.85)
                                    ])
                                    
                                    ctx.fill(path, with: .conicGradient(gradient, center: .zero, angle: .degrees(-75)))
                                    
                                    // Crisp Leading Edge Line
                                    var edgeLine = Path()
                                    edgeLine.move(to: .zero)
                                    edgeLine.addLine(to: CGPoint(x: 75, y: 0))
                                    ctx.stroke(edgeLine, with: .color(.white), lineWidth: 2.0)
                                }
                                .frame(width: 150, height: 150)
                            }
                            .clipShape(Circle())
                            
                            // Center Glowing Hub
                            Circle()
                                .fill(theme.primaryAccent(isDark: isDark))
                                .frame(width: 8, height: 8)
                                .shadow(color: theme.primaryAccent(isDark: isDark).opacity(1.0), radius: 6)
                            
                            // Target Blips with Glowing Ping Waves
                            ForEach(Array(devices.enumerated()), id: \.element.id) { index, device in
                                let isSelected = selectedDeviceId == device.id
                                let angle = Double(index * 85 + 35) * (.pi / 180.0)
                                let distance: CGFloat = 42 + CGFloat(index % 2) * 16
                                let x = cos(angle) * distance
                                let y = sin(angle) * distance
                                
                                Button(action: { selectedDeviceId = device.id }) {
                                    ZStack {
                                        Circle()
                                            .stroke(CopSightTheme.emerald.opacity(0.6), lineWidth: 1.5)
                                            .frame(width: 18, height: 18)
                                        
                                        Circle()
                                            .fill(isSelected ? theme.primaryAccent(isDark: isDark) : CopSightTheme.emeraldBright)
                                            .frame(width: isSelected ? 10 : 8, height: isSelected ? 10 : 8)
                                            .shadow(color: isSelected ? theme.primaryAccent(isDark: isDark) : CopSightTheme.emerald, radius: 8)
                                    }
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                                .offset(x: x, y: y)
                            }
                        }
                        
                        // Status Indicator Tag
                        HStack(spacing: 6) {
                            Circle()
                                .fill(CopSightTheme.emerald)
                                .frame(width: 7, height: 7)
                                .shadow(color: CopSightTheme.emerald.opacity(0.9), radius: 4)
                            Text(isScanning ? "SWEEPING BUS..." : "IOKIT RADAR ACTIVE")
                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(100)
                    }
                    .frame(width: 155)
                    
                    // Compact Device Cards with Hover Inspector
                    VStack(alignment: .leading, spacing: 10) {
                        Text("DETECTED TARGETS")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.75))
                        
                        if devices.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "cable.connector.slash")
                                    .font(.system(size: 22))
                                    .foregroundColor(.white.opacity(0.5))
                                Text("No Target Attached")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white)
                                Text("Plug in USB mobile device")
                                    .font(.system(size: 9.5, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(CopSightTheme.innerRadius)
                        } else {
                            ForEach(devices) { dev in
                                let isSelected = selectedDeviceId == dev.id
                                let isHovered = hoveredDeviceId == dev.id
                                
                                Button(action: { selectedDeviceId = dev.id }) {
                                    HStack(spacing: 12) {
                                        // Compact Icon with Status Badge
                                        ZStack(alignment: .bottomTrailing) {
                                            Circle()
                                                .fill(isSelected ? theme.primaryAccent(isDark: isDark) : theme.iconCircleBg(isDark: isDark))
                                                .frame(width: 38, height: 38)
                                                .overlay(
                                                    Image(systemName: dev.platform == "iOS" ? "iphone" : "smartphone")
                                                        .font(.system(size: 17))
                                                        .foregroundColor(isSelected ? theme.primaryAccentText(isDark: isDark) : .white)
                                                )
                                            
                                            Circle()
                                                .fill(CopSightTheme.emerald)
                                                .frame(width: 10, height: 10)
                                                .overlay(Circle().stroke(Color.black, lineWidth: 1.5))
                                        }
                                        
                                        VStack(alignment: .leading, spacing: 2) {
                                            HStack(spacing: 6) {
                                                Text(dev.model)
                                                    .font(.system(size: 12.5, weight: .bold))
                                                    .foregroundColor(.white)
                                                    .lineLimit(1)
                                                
                                                Text(dev.platform)
                                                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                                    .padding(.horizontal, 6)
                                                    .padding(.vertical, 2)
                                                    .background(CopSightTheme.emerald.opacity(0.25))
                                                    .foregroundColor(CopSightTheme.emerald)
                                                    .cornerRadius(4)
                                            }
                                            
                                            Text(dev.serial)
                                                .font(.system(size: 9.5, design: .monospaced))
                                                .foregroundColor(.white.opacity(0.7))
                                                .lineLimit(1)
                                        }
                                        
                                        Spacer()
                                        
                                        Image(systemName: isHovered ? "info.circle.fill" : "chevron.right")
                                            .font(.system(size: 12))
                                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                                    }
                                    .padding(12)
                                    .background(isSelected
                                        ? (isDark ? Color.white.opacity(0.16) : CopSightTheme.coral.opacity(0.18))
                                        : theme.insetFill(isDark: isDark)
                                    )
                                    .cornerRadius(CopSightTheme.innerRadius)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                                            .strokeBorder(isSelected ? theme.primaryAccent(isDark: isDark) : theme.insetBorder(isDark: isDark), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                                .onHover { hovering in
                                    hoveredDeviceId = hovering ? dev.id : nil
                                }
                                .popover(isPresented: Binding(
                                    get: { hoveredDeviceId == dev.id },
                                    set: { if !$0 && hoveredDeviceId == dev.id { hoveredDeviceId = nil } }
                                ), arrowEdge: .trailing) {
                                    // Rich Forensic Hover Inspector
                                    VStack(alignment: .leading, spacing: 10) {
                                        HStack(spacing: 8) {
                                            Image(systemName: dev.platform == "iOS" ? "iphone" : "smartphone")
                                                .font(.system(size: 14))
                                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                            Text(dev.model)
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.white)
                                        }
                                        
                                        Divider().background(Color.white.opacity(0.15))
                                        
                                        VStack(spacing: 6) {
                                            InspectorRow(label: "OS BUILD", val: dev.osVersion)
                                            InspectorRow(label: "SERIAL", val: dev.serial)
                                            InspectorRow(label: "BUS SPEED", val: dev.busSpeed)
                                            InspectorRow(label: "PAIRING", val: dev.pairingStatus)
                                            InspectorRow(label: "WRITE-BLOCK", val: dev.writeBlockStatus)
                                        }
                                    }
                                    .padding(14)
                                    .frame(width: 280)
                                    .background(theme.canvasBg(isDark: isDark))
                                }
                            }
                        }
                        
                        Spacer(minLength: 0)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                
                Spacer(minLength: 0)
            }
        }
        .frame(height: 500)
    }
}

struct InspectorRow: View {
    let label: String
    let val: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.65))
            Spacer()
            Text(val)
                .font(.system(size: 9.5, design: .monospaced))
                .foregroundColor(.white)
                .lineLimit(1)
        }
    }
}
