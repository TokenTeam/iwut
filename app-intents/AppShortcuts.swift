import AppIntents

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
        AppShortcut(
            intent: TodayCoursesIntent(),
            phrases: [
                "Show today's courses in \(.applicationName)",
                "用 \(.applicationName) 查看今日课程",
                "\(.applicationName) 今天有什么课",
            ],
            shortTitle: "schedule.intent.todayTitle",
            systemImageName: "calendar"
        )
        AppShortcut(
            intent: TomorrowCoursesIntent(),
            phrases: [
                "Show tomorrow's courses in \(.applicationName)",
                "用 \(.applicationName) 查看明日课程",
                "\(.applicationName) 明天有什么课",
            ],
            shortTitle: "schedule.intent.tomorrowTitle",
            systemImageName: "calendar.badge.clock"
        )
        AppShortcut(
            intent: NextCourseIntent(),
            phrases: [
                "Show my next course in \(.applicationName)",
                "用 \(.applicationName) 查看下一节课",
                "\(.applicationName) 下一节是什么课",
            ],
            shortTitle: "schedule.intent.nextTitle",
            systemImageName: "clock"
        )
    }
}
