internal import ExpoModulesCore

final class WlanModule: Module {
    public func definition() -> ModuleDefinition {
        Name("Wlan")
        AsyncFunction("saveCredentials") { (username: String, password: String) in
            try WlanCredentialStore().save(username: username, password: password)
        }
        AsyncFunction("clearCredentials") {
            try WlanCredentialStore().clear()
        }
        AsyncFunction("hasCredentials") { () -> Bool in
            WlanCredentialStore().load() != nil
        }
        AsyncFunction("getSavedUsername") { () -> String? in
            WlanCredentialStore().load()?.username
        }
        AsyncFunction("login") { () async -> [String: String] in
            await WlanService.login()
        }
        AsyncFunction("requestPinnedShortcut") { () -> Bool in
            false
        }
    }
}
