import ExpoModulesCore
import WidgetKit

public class WidgetModule: Module {
    public func definition() -> ModuleDefinition {
        Name("Widget")

        AsyncFunction("setWidgetData") { (key: String, json: String) in
            let defaults = UserDefaults(suiteName: "group.dev.tokenteam.iwut")
            defaults?.set(json, forKey: key)
        }

        AsyncFunction("reloadWidgets") {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
