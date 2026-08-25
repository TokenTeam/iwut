import ExpoModulesCore
import Foundation
import Security
import WebKit

public class ResetModule: Module {
    private static let appGroup = "group.dev.tokenteam.iwut"

    public func definition() -> ModuleDefinition {
        Name("Reset")

        AsyncFunction("resetNativeData") {
            self.clearKeychain()
            self.clearUserDefaults()
            self.clearFiles()
            await self.clearWebViewData()
        }.runOnQueue(.main)
    }

    private func clearKeychain() {
        let classes: [CFString] = [
            kSecClassGenericPassword,
            kSecClassInternetPassword,
            kSecClassCertificate,
            kSecClassKey,
            kSecClassIdentity,
        ]
        for itemClass in classes {
            SecItemDelete([
                kSecClass as String: itemClass,
            ] as CFDictionary)
        }
    }

    private func clearUserDefaults() {
        if let bundleIdentifier = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleIdentifier)
        }
        UserDefaults.standard.synchronize()

        if let sharedDefaults = UserDefaults(suiteName: Self.appGroup) {
            for key in sharedDefaults.dictionaryRepresentation().keys {
                sharedDefaults.removeObject(forKey: key)
            }
            sharedDefaults.synchronize()
        }
    }

    private func clearFiles() {
        let fileManager = FileManager.default
        let directories: [FileManager.SearchPathDirectory] = [
            .documentDirectory,
            .cachesDirectory,
            .applicationSupportDirectory,
        ]

        for directory in directories {
            guard let url = fileManager.urls(
                for: directory,
                in: .userDomainMask
            ).first else {
                continue
            }
            clearContents(of: url, using: fileManager)
        }

        clearContents(
            of: URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true),
            using: fileManager
        )

        if let sharedContainer = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroup
        ) {
            clearContents(of: sharedContainer, using: fileManager)
        }
    }

    private func clearContents(
        of directory: URL,
        using fileManager: FileManager
    ) {
        guard let children = try? fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ) else {
            return
        }

        for child in children {
            try? fileManager.removeItem(at: child)
        }
    }

    private func clearWebViewData() async {
        HTTPCookieStorage.shared.cookies?.forEach {
            HTTPCookieStorage.shared.deleteCookie($0)
        }
        URLCache.shared.removeAllCachedResponses()
        for (space, credentials) in URLCredentialStorage.shared.allCredentials {
            for credential in credentials.values {
                URLCredentialStorage.shared.remove(credential, for: space)
            }
        }

        let dataStore = WKWebsiteDataStore.default()
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        let since = Date(timeIntervalSince1970: 0)

        await withCheckedContinuation { continuation in
            dataStore.removeData(
                ofTypes: dataTypes,
                modifiedSince: since
            ) {
                continuation.resume()
            }
        }
    }
}
