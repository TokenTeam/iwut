import Foundation

struct WidgetCourse: Codable {
    let name: String
    let room: String
    let day: Int
    let weekStart: Int
    let weekEnd: Int
    let sectionStart: Int
    let sectionEnd: Int
    let startTime: String
    let endTime: String
}

struct ScheduleWidgetData: Codable {
    let courses: [WidgetCourse]
    let termStart: String
    let updatedAt: String

    static func load() -> ScheduleWidgetData? {
        guard let defaults = UserDefaults(suiteName: "group.dev.tokenteam.iwut"),
              let json = defaults.string(forKey: "schedule"),
              let data = json.data(using: .utf8)
        else { return nil }

        return try? JSONDecoder().decode(ScheduleWidgetData.self, from: data)
    }
}

struct ScheduleHelper {
    static func currentWeek(termStart: String) -> Int {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let startDate = formatter.date(from: termStart) else { return 1 }

        let now = Date()
        let diffSeconds = now.timeIntervalSince(startDate)
        if diffSeconds < 0 { return 0 }
        let diffDays = Int(diffSeconds / 86400)
        return diffDays / 7 + 1
    }

    static func dayOfWeek(for date: Date = .now) -> Int {
        let weekday = Calendar.current.component(.weekday, from: date)
        return weekday == 1 ? 7 : weekday - 1
    }

    static func tomorrowDayOfWeek() -> Int {
        let today = dayOfWeek()
        return today == 7 ? 1 : today + 1
    }

    static func tomorrowWeek(termStart: String) -> Int {
        let today = dayOfWeek()
        let week = currentWeek(termStart: termStart)
        return today == 7 ? week + 1 : week
    }

    static func weekStr(week: Int) -> String {
        String(format: WidgetStrings.localized("widget.weekDisplay"), week)
    }

    static func dateStr(for date: Date = .now) -> String {
        let cal = Calendar.current
        let month = cal.component(.month, from: date)
        let day = cal.component(.day, from: date)
        return String(format: WidgetStrings.localized("widget.monthDay"), month, day)
    }

    static func dayOfWeekStr(day: Int) -> String {
        WidgetStrings.dayOfWeek(day)
    }

    static func parseTimeToMinutes(_ time: String) -> Int {
        let parts = time.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else { return 0 }
        return hour * 60 + minute
    }

    static func todayCourses(from data: ScheduleWidgetData) -> [WidgetCourse] {
        let week = currentWeek(termStart: data.termStart)
        let today = dayOfWeek()
        return data.courses
            .filter { $0.day == today && $0.weekStart <= week && $0.weekEnd >= week }
            .sorted { $0.sectionStart < $1.sectionStart }
    }

    static func tomorrowCourses(from data: ScheduleWidgetData) -> [WidgetCourse] {
        let tWeek = tomorrowWeek(termStart: data.termStart)
        let tDay = tomorrowDayOfWeek()
        return data.courses
            .filter { $0.day == tDay && $0.weekStart <= tWeek && $0.weekEnd >= tWeek }
            .sorted { $0.sectionStart < $1.sectionStart }
    }

    static func upcomingTodayCourses(from data: ScheduleWidgetData) -> [WidgetCourse] {
        let cal = Calendar.current
        let nowMin = cal.component(.hour, from: .now) * 60 + cal.component(.minute, from: .now)
        return todayCourses(from: data).filter {
            parseTimeToMinutes($0.endTime) > nowMin
        }
    }
}
