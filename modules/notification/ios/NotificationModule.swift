import ActivityKit
import ExpoModulesCore
import UserNotifications

public class NotificationModule: Module {
    private let delegateProxy = NotificationDelegateProxy()

    public func definition() -> ModuleDefinition {
        Name("Notification")

        OnCreate {
            let center = UNUserNotificationCenter.current()
            center.delegate = self.delegateProxy
            center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        }

        AsyncFunction("createChannel") { (_: String, _: String, _: String) in
        }

        AsyncFunction("showCountdown") { (id: Int, _: String, title: String, body: String, targetTimeMs: Double, _: Bool, autoDismiss: Bool) in
            let targetDate = Date(timeIntervalSince1970: targetTimeMs / 1000.0)

            if #available(iOS 16.2, *) {
                try await self.startOrUpdateLiveActivity(id: id, title: title, body: body, targetDate: targetDate)
            } else {
                self.showLocalNotification(id: id, title: title, body: body, triggerDate: nil, autoDismiss: autoDismiss)
            }
        }

        AsyncFunction("scheduleCountdown") { (id: Int, _: String, title: String, body: String, triggerAtMs: Double, targetTimeMs: Double, _: Bool, autoDismiss: Bool) in
            let triggerDate = Date(timeIntervalSince1970: triggerAtMs / 1000.0)
            let targetDate = Date(timeIntervalSince1970: targetTimeMs / 1000.0)

            if #available(iOS 16.2, *) {
                let now = Date()
                if triggerDate <= now {
                    try await self.startOrUpdateLiveActivity(id: id, title: title, body: body, targetDate: targetDate)
                } else {
                    self.scheduleLiveActivityViaNotification(id: id, title: title, body: body, triggerDate: triggerDate, targetDate: targetDate)
                }
            } else {
                self.showLocalNotification(id: id, title: title, body: body, triggerDate: triggerDate, autoDismiss: autoDismiss)
            }
        }

        AsyncFunction("cancel") { (id: Int) in
            if #available(iOS 16.2, *) {
                await self.endLiveActivity(id: id)
            }
            self.cancelLocalNotification(id: id)
        }

        AsyncFunction("cancelAll") { () in
            if #available(iOS 16.2, *) {
                await self.endAllLiveActivities()
            }
            self.cancelAllLocalNotifications()
        }
    }

    @available(iOS 16.2, *)
    private func startOrUpdateLiveActivity(id: Int, title: String, body: String, targetDate: Date) async throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let state = CountdownActivityAttributes.ContentState(targetTime: targetDate)
        let content = ActivityContent(state: state, staleDate: targetDate)

        if let activity = self.loadLiveActivity(for: id) {
            await activity.update(content)
            return
        }

        let attributes = CountdownActivityAttributes(title: title, subtitle: body)
        let activity = try Activity<CountdownActivityAttributes>.request(
            attributes: attributes,
            content: content,
            pushType: nil
        )

        self.saveActivityMapping(id: id, activityId: activity.id)
    }

    @available(iOS 16.2, *)
    private func loadLiveActivity(for id: Int) -> Activity<CountdownActivityAttributes>? {
        guard let activityId = self.loadActivityId(for: id) else { return nil }

        if let activity = Activity<CountdownActivityAttributes>.activities.first(where: { $0.id == activityId }) {
            return activity
        }

        self.removeActivityMapping(id: id)
        return nil
    }

    @available(iOS 16.2, *)
    private func endLiveActivity(id: Int) async {
        guard let activityId = self.loadActivityId(for: id) else { return }

        for activity in Activity<CountdownActivityAttributes>.activities where activity.id == activityId {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        self.removeActivityMapping(id: id)
    }

    @available(iOS 16.2, *)
    private func endAllLiveActivities() async {
        for activity in Activity<CountdownActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        self.clearAllActivityMappings()
    }

    @available(iOS 16.2, *)
    private func scheduleLiveActivityViaNotification(id: Int, title: String, body: String, triggerDate: Date, targetDate: Date) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = [
            "liveActivityId": id,
            "targetTimeMs": targetDate.timeIntervalSince1970 * 1000,
            "isLiveActivityTrigger": true,
        ]

        let interval = triggerDate.timeIntervalSinceNow
        guard interval > 0 else { return }

        let identifier = "notification_\(id)"
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [identifier])
        UNUserNotificationCenter.current().add(request)
    }

    private func showLocalNotification(id: Int, title: String, body: String, triggerDate: Date?, autoDismiss: Bool) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let trigger: UNNotificationTrigger?
        if let triggerDate = triggerDate {
            let interval = triggerDate.timeIntervalSinceNow
            guard interval > 0 else { return }
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        } else {
            trigger = nil
        }

        let identifier = "notification_\(id)"
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [identifier])
        UNUserNotificationCenter.current().add(request)
    }

    private func cancelLocalNotification(id: Int) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["notification_\(id)"])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["notification_\(id)"])
    }

    private func cancelAllLocalNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    private static let suiteName = "group.dev.tokenteam.iwut"
    private static let activityMapKey = "live_activity_map"

    private func saveActivityMapping(id: Int, activityId: String) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else { return }
        var map = defaults.dictionary(forKey: Self.activityMapKey) as? [String: String] ?? [:]
        map[String(id)] = activityId
        defaults.set(map, forKey: Self.activityMapKey)
    }

    private func loadActivityId(for id: Int) -> String? {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else { return nil }
        let map = defaults.dictionary(forKey: Self.activityMapKey) as? [String: String] ?? [:]
        return map[String(id)]
    }

    private func removeActivityMapping(id: Int) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else { return }
        var map = defaults.dictionary(forKey: Self.activityMapKey) as? [String: String] ?? [:]
        map.removeValue(forKey: String(id))
        defaults.set(map, forKey: Self.activityMapKey)
    }

    private func clearAllActivityMappings() {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else { return }
        defaults.removeObject(forKey: Self.activityMapKey)
    }
}

private class NotificationDelegateProxy: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}
