import AppIntents
import Foundation
import Security

@available(iOS 16.0, *)
struct WlanIntent: AppIntent {
    static var title: LocalizedStringResource = "wlan.intent.title"
    static var description = IntentDescription("wlan.intent.description")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let credentials = WlanCredentialStore().load() else {
            return .result(dialog: "\(WlanStrings.localized("wlan.intent.noCredentials"))")
        }

        let result = await WlanAuthenticator().login(credentials: credentials)
        switch result.status {
        case .connected:
            return .result(dialog: "\(WlanStrings.localized("wlan.intent.connected"))")
        case .alreadyOnline:
            return .result(dialog: "\(WlanStrings.localized("wlan.intent.alreadyOnline"))")
        case .authenticationFailed:
            return .result(dialog: "\(WlanStrings.localized("wlan.intent.authenticationFailed"))")
        case .networkUnavailable:
            return .result(dialog: "\(WlanStrings.localized("wlan.intent.networkUnavailable"))")
        }
    }
}

@available(iOS 16.0, *)
struct WlanShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: WlanIntent(),
            phrases: [
                "Use \(.applicationName) to connect to campus Wi-Fi",
                "Connect to campus Wi-Fi with \(.applicationName)",
                "使用 \(.applicationName) 连接校园网",
                "用 \(.applicationName) 登录校园网",
            ],
            shortTitle: "wlan.intent.shortTitle",
            systemImageName: "wifi"
        )
    }
}

private enum WlanStrings {
    static func localized(_ key: String) -> String {
        NSLocalizedString(key, bundle: .main, comment: "")
    }
}

private struct WlanCredentials: Codable {
    let username: String
    let password: String
}

private final class WlanCredentialStore {
    private let service = "dev.tokenteam.iwut.wlan"
    private let account = "credentials"

    func load() -> WlanCredentials? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: kCFBooleanTrue as Any,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else {
            return nil
        }
        return try? JSONDecoder().decode(WlanCredentials.self, from: data)
    }
}

private enum WlanStatus {
    case connected
    case alreadyOnline
    case networkUnavailable
    case authenticationFailed
}

private struct WlanResult {
    let status: WlanStatus
}

private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

private final class WlanAuthenticator {
    private let probeURL = URL(string: "http://223.5.5.5/generate_204")!
    private let gateway = URL(string: "http://172.30.21.100")!
    private let session: URLSession

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.allowsCellularAccess = false
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 20
        session = URLSession(
            configuration: configuration,
            delegate: NoRedirectDelegate(),
            delegateQueue: nil
        )
    }

    func login(credentials: WlanCredentials) async -> WlanResult {
        do {
            guard let portal = try await locatePortal() else {
                return WlanResult(status: .alreadyOnline)
            }
            let csrf = try await getCsrfToken()
            return try await performLogin(credentials: credentials, portal: portal, csrf: csrf)
        } catch {
            return WlanResult(status: .networkUnavailable)
        }
    }

    private func locatePortal() async throws -> PortalParameters? {
        var request = URLRequest(url: probeURL)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw WlanError.invalidResponse
        }

        guard let location = httpResponse.value(forHTTPHeaderField: "Location"),
              let url = URL(string: location),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            return nil
        }
        let queryValues = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap {
            item in item.value.map { (item.name, $0) }
        })
        guard let nasId = queryValues["nasId"] ?? url.lastPathComponent.nilIfEmpty else {
            return nil
        }
        return PortalParameters(
            nasId: nasId,
            switchip: queryValues["switchip"] ?? ""
        )
    }

    private func getCsrfToken() async throws -> String {
        let (data, response) = try await session.data(
            from: gateway.appendingPathComponent("api/csrf-token")
        )
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode),
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = object["csrf_token"] as? String
        else {
            throw WlanError.invalidResponse
        }
        return token
    }

    private func performLogin(
        credentials: WlanCredentials,
        portal: PortalParameters,
        csrf: String
    ) async throws -> WlanResult {
        var request = URLRequest(url: gateway.appendingPathComponent("api/account/login"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue(csrf, forHTTPHeaderField: "x-csrf-token")

        var components = URLComponents()
        components.queryItems = [
            URLQueryItem(name: "username", value: credentials.username),
            URLQueryItem(name: "password", value: credentials.password),
            URLQueryItem(name: "nasId", value: portal.nasId),
            URLQueryItem(name: "switchip", value: portal.switchip),
            URLQueryItem(name: "userIpv4", value: ""),
            URLQueryItem(name: "userMac", value: ""),
            URLQueryItem(name: "captcha", value: ""),
            URLQueryItem(name: "captchaId", value: ""),
        ]
        request.httpBody = components.percentEncodedQuery?.data(using: .utf8)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode),
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            throw WlanError.invalidResponse
        }

        if (object["code"] as? Int) == 0 {
            return WlanResult(status: .connected)
        }
        return WlanResult(status: .authenticationFailed)
    }
}

private struct PortalParameters {
    let nasId: String
    let switchip: String
}

private enum WlanError: Error {
    case invalidResponse
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
