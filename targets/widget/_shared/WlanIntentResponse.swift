enum WlanIntentResponse {
    static func key(for status: String?) -> String {
        switch status {
        case "connected": return "wlan.intent.connected"
        case "already-online": return "wlan.intent.alreadyOnline"
        case "no-credentials": return "wlan.intent.noCredentials"
        case "authentication-failed": return "wlan.intent.authenticationFailed"
        default: return "wlan.intent.networkUnavailable"
        }
    }
}
