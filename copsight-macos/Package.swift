// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "CopSightAI",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "CopSightAI", targets: ["CopSightAI"])
    ],
    targets: [
        .executableTarget(
            name: "CopSightAI",
            path: "Sources/CopSightAI",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
