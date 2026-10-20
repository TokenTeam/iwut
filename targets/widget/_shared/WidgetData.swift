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

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        room = (try? c.decodeIfPresent(String.self, forKey: .room)) ?? ""
        day = (try? c.decodeIfPresent(Int.self, forKey: .day)) ?? 0
        weekStart = (try? c.decodeIfPresent(Int.self, forKey: .weekStart)) ?? 0
        weekEnd = (try? c.decodeIfPresent(Int.self, forKey: .weekEnd)) ?? 0
        sectionStart = (try? c.decodeIfPresent(Int.self, forKey: .sectionStart)) ?? 0
        sectionEnd = (try? c.decodeIfPresent(Int.self, forKey: .sectionEnd)) ?? 0
        startTime = (try? c.decodeIfPresent(String.self, forKey: .startTime)) ?? ""
        endTime = (try? c.decodeIfPresent(String.self, forKey: .endTime)) ?? ""
    }
}

struct ScheduleWidgetData: Codable {
    let courses: [WidgetCourse]
    let termStart: String
    let updatedAt: String
    let hasValidCourseList: Bool

    enum CodingKeys: String, CodingKey {
        case courses, termStart, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if var arr = try? c.nestedUnkeyedContainer(forKey: .courses) {
            var parsed: [WidgetCourse] = []
            var hasMalformedEntry = false
            while !arr.isAtEnd {
                if let course = try? arr.decode(WidgetCourse.self) {
                    parsed.append(course)
                } else {
                    hasMalformedEntry = true
                    _ = try? arr.decode(AnyDecodable.self)
                }
            }
            courses = parsed
            hasValidCourseList = !hasMalformedEntry
        } else {
            courses = []
            hasValidCourseList = false
        }
        termStart = (try? c.decodeIfPresent(String.self, forKey: .termStart)) ?? ""
        updatedAt = (try? c.decodeIfPresent(String.self, forKey: .updatedAt)) ?? ""
    }

    static func load() -> ScheduleWidgetData? {
        guard let defaults = UserDefaults(suiteName: "group.dev.tokenteam.iwut"),
              let json = defaults.string(forKey: "schedule"),
              let data = json.data(using: .utf8)
        else { return nil }

        return try? JSONDecoder().decode(ScheduleWidgetData.self, from: data)
    }
}

private struct AnyDecodable: Decodable {
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { return }
        if (try? container.decode(Bool.self)) != nil { return }
        if (try? container.decode(Double.self)) != nil { return }
        if (try? container.decode(String.self)) != nil { return }
        if (try? container.decode([AnyDecodable].self)) != nil { return }
        _ = try? container.decode([String: AnyDecodable].self)
    }
}

struct ScheduleHelper {
    static let maxWeek = 20

    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Shanghai")!
        return calendar
    }

    static func rawWeek(termStart: String, now: Date) -> Int? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.isLenient = false
        guard let startDate = formatter.date(from: termStart),
              formatter.string(from: startDate) == termStart else { return nil }

        let cal = calendar
        let startOfTerm = cal.startOfDay(for: startDate)
        let startOfNow = cal.startOfDay(for: now)
        let diffDays = cal.dateComponents([.day], from: startOfTerm, to: startOfNow).day ?? 0
        if diffDays < 0 { return 0 }
        return diffDays / 7 + 1
    }

    static func currentWeek(termStart: String, now: Date) -> Int {
        rawWeek(termStart: termStart, now: now) ?? 1
    }

    static func dayOfWeek(for date: Date) -> Int {
        let weekday = calendar.component(.weekday, from: date)
        return weekday == 1 ? 7 : weekday - 1
    }

    static func tomorrowDayOfWeek(now: Date) -> Int {
        let today = dayOfWeek(for: now)
        return today == 7 ? 1 : today + 1
    }

    static func tomorrowWeek(termStart: String, now: Date) -> Int {
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) ?? now
        return currentWeek(termStart: termStart, now: tomorrow)
    }

    static func weekStr(week: Int) -> String {
        String(format: WidgetStrings.localized("widget.weekDisplay"), week)
    }

    static func weekDisplayString(week: Int) -> String {
        if !(1...maxWeek).contains(week) {
            return WidgetStrings.localized("widget.vacation")
        }
        return weekStr(week: week)
    }

    static func dateStr(for date: Date) -> String {
        let cal = calendar
        let month = cal.component(.month, from: date)
        let day = cal.component(.day, from: date)
        return String(format: WidgetStrings.localized("widget.monthDay"), month, day)
    }

    static func dayOfWeekStr(day: Int) -> String {
        WidgetStrings.dayOfWeek(day)
    }

    static func parseTimeToMinutes(_ time: String) -> Int {
        timeToMinutes(time) ?? 0
    }

    static func timeToMinutes(_ time: String) -> Int? {
        let parts = time.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]),
              (0...23).contains(hour),
              (0...59).contains(minute) else { return nil }
        return hour * 60 + minute
    }

    static func todayCourses(from data: ScheduleWidgetData, now: Date) -> [WidgetCourse] {
        let week = currentWeek(termStart: data.termStart, now: now)
        guard (1...maxWeek).contains(week) else { return [] }
        let today = dayOfWeek(for: now)
        return data.courses
            .filter { $0.day == today && $0.weekStart <= week && $0.weekEnd >= week }
            .sorted(by: courseOrder)
    }

    static func tomorrowCourses(from data: ScheduleWidgetData, now: Date) -> [WidgetCourse] {
        let tWeek = tomorrowWeek(termStart: data.termStart, now: now)
        guard (1...maxWeek).contains(tWeek) else { return [] }
        let tDay = tomorrowDayOfWeek(now: now)
        return data.courses
            .filter { $0.day == tDay && $0.weekStart <= tWeek && $0.weekEnd >= tWeek }
            .sorted(by: courseOrder)
    }

    static func upcomingTodayCourses(from data: ScheduleWidgetData, now: Date) -> [WidgetCourse] {
        let cal = calendar
        let nowMin = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        return todayCourses(from: data, now: now).filter {
            parseTimeToMinutes($0.endTime) > nowMin
        }
    }

    private static func courseOrder(_ lhs: WidgetCourse, _ rhs: WidgetCourse) -> Bool {
        let left = timeToMinutes(lhs.startTime) ?? lhs.sectionStart * 60
        let right = timeToMinutes(rhs.startTime) ?? rhs.sectionStart * 60
        if left != right { return left < right }
        return lhs.sectionStart < rhs.sectionStart
    }
}
