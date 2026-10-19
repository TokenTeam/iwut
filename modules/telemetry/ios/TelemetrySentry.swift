import Foundation
import RNSentry

@objc(TelemetrySentry)
public final class TelemetrySentry: NSObject {
    @objc public static func start() {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: "telemetry_enabled") as? Bool ?? true else {
            return
        }
        RNSentrySDK.start { options in
            let previousBeforeSend = options.beforeSend
            options.beforeSend = { event in
                guard defaults.object(forKey: "telemetry_enabled") as? Bool ?? true else {
                    return nil
                }
                if let previousBeforeSend = previousBeforeSend {
                    return previousBeforeSend(event)
                }
                return event
            }
        }
    }
}
