import ExpoModulesCore
import Foundation
import Sentry

public class TelemetryModule: Module {
    public func definition() -> ModuleDefinition {
        Name("Telemetry")

        Function("isEnabled") {
            UserDefaults.standard.object(forKey: "telemetry_enabled") as? Bool ?? true
        }

        AsyncFunction("setEnabled") { (enabled: Bool) in
            let defaults = UserDefaults.standard
            defaults.set(enabled, forKey: "telemetry_enabled")
            defaults.synchronize()
            if enabled {
                TelemetrySentry.start()
            } else {
                SentrySDK.close()
            }
        }.runOnQueue(.main)
    }
}
