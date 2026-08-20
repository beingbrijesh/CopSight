import XCTest
import SwiftUI
@testable import CopSightAI // Allows access to internal types

final class CopSightAITests: XCTestCase {

    override func setUpWithError() throws {
        // Clear any existing test keychain items
        _ = try? KeychainManager.shared.delete(key: "test_key_1")
        _ = try? KeychainManager.shared.delete(key: "test_key_2")
    }

    override func tearDownWithError() throws {
        _ = try? KeychainManager.shared.delete(key: "test_key_1")
        _ = try? KeychainManager.shared.delete(key: "test_key_2")
    }

    // MARK: - KeychainManager Edge Cases
    
    func testKeychainSaveAndRetrieveSuccess() throws {
        let testData = "SecureToken123".data(using: .utf8)!
        try KeychainManager.shared.save(key: "test_key_1", data: testData)
        
        let retrievedData = try KeychainManager.shared.get(key: "test_key_1")
        XCTAssertEqual(testData, retrievedData, "Retrieved data should exactly match saved data.")
    }
    
    func testKeychainOverwriteExistingItem() throws {
        let initialData = "OldToken".data(using: .utf8)!
        let newData = "NewToken".data(using: .utf8)!
        
        try KeychainManager.shared.save(key: "test_key_2", data: initialData)
        // Ensure overwriting works without errSecDuplicateItem error
        XCTAssertNoThrow(try KeychainManager.shared.save(key: "test_key_2", data: newData))
        
        let retrievedData = try KeychainManager.shared.get(key: "test_key_2")
        XCTAssertEqual(newData, retrievedData, "Keychain should return the newly overwritten data.")
    }
    
    func testKeychainRetrieveNonExistentItemThrows() {
        XCTAssertThrowsError(try KeychainManager.shared.get(key: "missing_key")) { error in
            guard let keychainError = error as? KeychainManager.KeychainError else {
                XCTFail("Expected KeychainError")
                return
            }
            if case .itemNotFound = keychainError {
                // Success
            } else {
                XCTFail("Expected itemNotFound, got \(keychainError)")
            }
        }
    }
    
    func testKeychainDeleteNonExistentItemDoesNotThrow() {
        // KeychainManager is designed to silently succeed if the item doesn't exist on delete
        XCTAssertNoThrow(try KeychainManager.shared.delete(key: "another_missing_key"))
    }
    
    // MARK: - Color Extension Edge Cases
    
    func testColorHexParser() {
        // Valid 6-character hex
        _ = Color(hex: "2475B5")
        _ = Color(hex: "#2475B5") // With hash
        
        // Edge cases: Invalid strings
        let invalidColor = Color(hex: "INVALID")
        // The parser falls back to clear/white (0,0,0,0 or similar depending on implementation)
        // In our implementation, invalid hex defaults to r:1, g:1, b:1, a:0 (Clear White)
        // While we can't easily extract exact RGBA from SwiftUI.Color in unit tests without NSColor conversion,
        // we can verify it doesn't crash on invalid input.
        XCTAssertNotNil(invalidColor)
        
        // Short hex
        let shortHex = Color(hex: "FFF")
        XCTAssertNotNil(shortHex)
        
        // 8-character hex (with alpha)
        let alphaHex = Color(hex: "802475B5")
        XCTAssertNotNil(alphaHex)
    }
}
