import AppIntents
import Foundation

struct WlanIntent: AppIntent {
    static var title: LocalizedStringResource = "wlan.intent.title"
    static var description = IntentDescription("wlan.intent.description")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let result = await WlanService.login()
        let text = WidgetStrings.localized(WlanIntentResponse.key(for: result["status"]))
        return .result(dialog: "\(text)")
    }
}
