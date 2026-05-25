import ExpoModulesCore
import Foundation
import Security

public class WlanModule: Module {
    private let credentials = WlanCredentialStore()
    private let authenticator = WlanAuthenticator()

    public func definition() -> ModuleDefinition {
        Name("Wlan")

        AsyncFunction("saveCredentials") { (username: String, password: String) in
            try self.credentials.save(username: username, password: password)
        }

        AsyncFunction("clearCredentials") {
            try self.credentials.clear()
        }

        AsyncFunction("hasCredentials") { () -> Bool in
            self.credentials.load() != nil
        }

        AsyncFunction("getSavedUsername") { () -> String? in
            self.credentials.load()?.username
        }

        AsyncFunction("login") { () async -> [String: String] in
            guard let credentials = self.credentials.load() else {
                return ["status": "no-credentials"]
            }
            return await self.authenticator.login(credentials: credentials)
        }

        AsyncFunction("requestPinnedShortcut") { () -> Bool in
            false
        }
    }
}

private struct WlanCredentials: Codable {
    let username: String
    let password: String
}

private final class WlanCredentialStore {
    private let service = "dev.tokenteam.iwut.wlan"
    private let account = "credentials"

    func save(username: String, password: String) throws {
        let data = try JSONEncoder().encode(WlanCredentials(username: username, password: password))
        let query = baseQuery
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insertion = query
            attributes.forEach { insertion[$0.key] = $0.value }
            let addStatus = SecItemAdd(insertion as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw WlanError.keychain(addStatus)
            }
            return
        }
        guard status == errSecSuccess else {
            throw WlanError.keychain(status)
        }
    }

    func load() -> WlanCredentials? {
        var query = baseQuery
        query[kSecReturnData as String] = kCFBooleanTrue
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else {
            return nil
        }
        return try? JSONDecoder().decode(WlanCredentials.self, from: data)
    }

    func clear() throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw WlanError.keychain(status)
        }
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
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

    func login(credentials: WlanCredentials) async -> [String: String] {
        do {
            let portal = try await locatePortal()
            guard let portal else {
                return ["status": "already-online"]
            }
            let csrf = try await getCsrfToken()
            return try await performLogin(credentials: credentials, portal: portal, csrf: csrf)
        } catch {
            return ["status": "network-unavailable"]
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

        let values = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap {
            item in item.value.map { (item.name, $0) }
        })
        guard let nasId = values["nasId"] ?? url.lastPathComponent.nilIfEmpty else {
            return nil
        }
        return PortalParameters(nasId: nasId, switchip: values["switchip"] ?? "")
    }

    private func getCsrfToken() async throws -> String {
        let url = gateway.appendingPathComponent("api/csrf-token")
        let (data, response) = try await session.data(from: url)
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
    ) async throws -> [String: String] {
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
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let code = object["code"] as? Int
        else {
            throw WlanError.invalidResponse
        }

        let message = object["msg"] as? String
        if code == 0 {
            var result = ["status": "connected"]
            if let message { result["message"] = message }
            return result
        }

        var result = ["status": "authentication-failed"]
        if let message { result["message"] = message }
        return result
    }
}

private struct PortalParameters {
    let nasId: String
    let switchip: String
}

private enum WlanError: LocalizedError {
    case invalidResponse
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid network response"
        case .keychain(let status):
            return "Keychain error: \(status)"
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
