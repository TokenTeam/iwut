import ActivityKit
import Foundation

public struct CountdownActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable & Hashable {
        public let targetTime: Date
    }

    public let title: String
    public let subtitle: String
}
