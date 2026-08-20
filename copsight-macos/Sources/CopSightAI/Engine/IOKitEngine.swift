import Foundation
import IOKit
import IOKit.usb

/// Native macOS IOKit USB event engine.
/// Replaces the Python daemon for extreme performance and zero idle CPU usage.
actor IOKitEngine {
    static let shared = IOKitEngine()
    
    // Type representing a forensic target device
    struct USBDevice: Identifiable, Sendable {
        let id: String
        let vendorName: String
        let productName: String
        let serialNumber: String
        let locationID: UInt32
    }
    
    enum USBEvent: Sendable {
        case connected(USBDevice)
        case disconnected(String) // ID
    }
    
    private init() {}
    
    /// Returns an asynchronous stream of USB connect/disconnect events
    func startMonitoring() -> AsyncStream<USBEvent> {
        return AsyncStream { continuation in
            let matchingDict = IOServiceMatching(kIOUSBDeviceClassName) as NSMutableDictionary
            
            let localNotifyPort = IONotificationPortCreate(kIOMainPortDefault)
            let localRunLoopSource = IONotificationPortGetRunLoopSource(localNotifyPort).takeUnretainedValue()
            CFRunLoopAddSource(CFRunLoopGetMain(), localRunLoopSource, .defaultMode)
            
            // We must pass the continuation to the C callback via an unsafe pointer
            let contextPtr = Unmanaged.passRetained(ContinuationWrapper(continuation: continuation)).toOpaque()
            let contextInt = Int(bitPattern: contextPtr) // Sendable
            
            var localAddedIterator: io_iterator_t = 0
            let addResult = IOServiceAddMatchingNotification(
                localNotifyPort,
                kIOFirstMatchNotification,
                matchingDict,
                deviceAddedCallback,
                contextPtr,
                &localAddedIterator
            )
            
            if addResult == kIOReturnSuccess {
                // Prime the iterator
                deviceAddedCallback(context: contextPtr, iterator: localAddedIterator)
            }
            
            // Remove Matching Notification
            let removedDict = IOServiceMatching(kIOUSBDeviceClassName) as NSMutableDictionary
            var localRemovedIterator: io_iterator_t = 0
            let removeResult = IOServiceAddMatchingNotification(
                localNotifyPort,
                kIOTerminatedNotification,
                removedDict,
                deviceRemovedCallback,
                contextPtr,
                &localRemovedIterator
            )
            
            if removeResult == kIOReturnSuccess {
                // Prime the iterator
                deviceRemovedCallback(context: contextPtr, iterator: localRemovedIterator)
            }
            
            let portInt = Int(bitPattern: localNotifyPort)
            
            // Capture constants for Sendable closure
            let finalAddedIterator = localAddedIterator
            let finalRemovedIterator = localRemovedIterator
            
            continuation.onTermination = { @Sendable _ in
                let ptr = UnsafeMutableRawPointer(bitPattern: contextInt)!
                let portRef = OpaquePointer(bitPattern: portInt)
                
                // Cleanup across concurrency boundaries
                CFRunLoopRemoveSource(CFRunLoopGetMain(), localRunLoopSource, .defaultMode)
                if let port = portRef {
                    IONotificationPortDestroy(port)
                }
                if finalAddedIterator != 0 {
                    IOObjectRelease(finalAddedIterator)
                }
                if finalRemovedIterator != 0 {
                    IOObjectRelease(finalRemovedIterator)
                }
                Unmanaged<ContinuationWrapper>.fromOpaque(ptr).release()
            }
        }
    }
}

// Wrapper to pass the AsyncStream.Continuation to a C-callback context
private final class ContinuationWrapper {
    let continuation: AsyncStream<IOKitEngine.USBEvent>.Continuation
    init(continuation: AsyncStream<IOKitEngine.USBEvent>.Continuation) {
        self.continuation = continuation
    }
}

// C-Callbacks for IOKit
private func deviceAddedCallback(context: UnsafeMutableRawPointer?, iterator: io_iterator_t) {
    guard let context = context else { return }
    let wrapper = Unmanaged<ContinuationWrapper>.fromOpaque(context).takeUnretainedValue()
    
    var usbDevice: io_object_t
    repeat {
        usbDevice = IOIteratorNext(iterator)
        guard usbDevice != 0 else { break }
        
        let device = extractDeviceData(from: usbDevice)
        wrapper.continuation.yield(.connected(device))
        
        IOObjectRelease(usbDevice)
    } while true
}

private func deviceRemovedCallback(context: UnsafeMutableRawPointer?, iterator: io_iterator_t) {
    guard let context = context else { return }
    let wrapper = Unmanaged<ContinuationWrapper>.fromOpaque(context).takeUnretainedValue()
    
    var usbDevice: io_object_t
    repeat {
        usbDevice = IOIteratorNext(iterator)
        guard usbDevice != 0 else { break }
        
        let locationID = extractLocationID(from: usbDevice)
        wrapper.continuation.yield(.disconnected(String(locationID)))
        
        IOObjectRelease(usbDevice)
    } while true
}

private func extractDeviceData(from device: io_object_t) -> IOKitEngine.USBDevice {
    let vendorName = getRegistryString(device, key: "USB Vendor Name") ?? "Unknown Vendor"
    let productName = getRegistryString(device, key: "USB Product Name") ?? "Unknown Product"
    let serialNumber = getRegistryString(device, key: "USB Serial Number") ?? "Unknown Serial"
    let locationID = extractLocationID(from: device)
    
    return IOKitEngine.USBDevice(
        id: String(locationID),
        vendorName: vendorName,
        productName: productName,
        serialNumber: serialNumber,
        locationID: locationID
    )
}

private func extractLocationID(from device: io_object_t) -> UInt32 {
    guard let numRef = IORegistryEntryCreateCFProperty(device, "locationID" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() else {
        return 0
    }
    if CFGetTypeID(numRef) == CFNumberGetTypeID() {
        var value: UInt32 = 0
        CFNumberGetValue((numRef as! CFNumber), CFNumberType.sInt32Type, &value)
        return value
    }
    return 0
}

private func getRegistryString(_ device: io_object_t, key: String) -> String? {
    guard let cfString = IORegistryEntryCreateCFProperty(device, key as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() else {
        return nil
    }
    return cfString as? String
}
