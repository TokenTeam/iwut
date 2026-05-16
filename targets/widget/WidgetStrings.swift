import Foundation

/// Localization helper for the widget. Resolves strings using the in-app
/// language synced from React Native via App Group `UserDefaults` (key:
/// `lang`), falling back to the device locale when nothing has been synced
/// yet (e.g. widget added before first app launch).
enum WidgetStrings {
    static func localized(_ key: String) -> String {
        let bundle = preferredBundle()
        return bundle.localizedString(forKey: key, value: nil, table: nil)
    }

    /// Returns the localized day-of-week label for ISO weekday 1..7 (Mon..Sun).
    static func dayOfWeek(_ day: Int) -> String {
        switch day {
        case 1: return localized("widget.weekday.mon")
        case 2: return localized("widget.weekday.tue")
        case 3: return localized("widget.weekday.wed")
        case 4: return localized("widget.weekday.thu")
        case 5: return localized("widget.weekday.fri")
        case 6: return localized("widget.weekday.sat")
        case 7: return localized("widget.weekday.sun")
        default: return ""
        }
    }

    private static func preferredBundle() -> Bundle {
        let defaults = UserDefaults(suiteName: "group.dev.tokenteam.iwut")
        let tag = defaults?.string(forKey: "lang") ?? ""
        guard !tag.isEmpty else { return .main }

        // Try the exact tag first (e.g. "zh-Hans"), then the base language
        // (e.g. "zh") so callers can pass either form.
        let candidates: [String]
        if tag.contains("-") {
            let base = String(tag.split(separator: "-").first ?? "")
            candidates = [tag, base]
        } else {
            candidates = [tag]
        }

        for candidate in candidates {
            if let path = Bundle.main.path(forResource: candidate, ofType: "lproj"),
               let bundle = Bundle(path: path) {
                return bundle
            }
        }
        return .main
    }
}
