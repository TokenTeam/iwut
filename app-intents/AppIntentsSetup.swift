internal import ExpoAppIntents
internal import ExpoModulesCore

final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("AppIntentsSetup")
    OnCreate {
      Task {
        await AppIntentDispatcher.shared.setShortcutsRefreshHandler {
          WlanShortcuts.updateAppShortcutParameters()
        }
        WlanShortcuts.updateAppShortcutParameters()
      }
    }
  }
}
