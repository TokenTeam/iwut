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

    // Tolerant decoding: a missing or `null` field (e.g. a course without a
    // room) must not blow up the whole payload and blank the widget. Missing
    // strings default to "" and missing numbers to 0.
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

    enum CodingKeys: String, CodingKey {
        case courses, termStart, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Decode courses element-by-element so a single malformed entry is
        // skipped rather than discarding the entire schedule.
        if var arr = try? c.nestedUnkeyedContainer(forKey: .courses) {
            var parsed: [WidgetCourse] = []
            while !arr.isAtEnd {
                if let course = try? arr.decode(WidgetCourse.self) {
                    parsed.append(course)
                } else {
                    // Skip the malformed element to keep the container moving.
                    _ = try? arr.decode(AnyDecodable.self)
                }
            }
            courses = parsed
        } else {
            courses = []
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

/// Throwaway type used to consume and discard a malformed array element so the
/// unkeyed decoding container can advance past it.
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

/// Pure date/schedule math for the widget.
///
/// Every method takes an explicit reference `now` instead of reading the
/// ambient `Date()`. This is critical: WidgetKit archives the rendered view
/// for *every* timeline entry at the moment `getTimeline` returns, then swaps
/// the pre-rendered snapshots in at their scheduled dates. If the view read
/// the wall-clock at render time, all future entries would freeze to the
/// "now" of generation and the widget would show stale (previous day's)
/// courses. Keeping these helpers pure of `entry.date` guarantees each entry
/// renders the correct content for the time it represents.
struct ScheduleHelper {
    static func currentWeek(termStart: String, now: Date) -> Int {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let startDate = formatter.date(from: termStart) else { return 1 }

        // Compare from the *start of day* in the device timezone so the week
        // number flips exactly at local midnight rather than drifting with the
        // time component of `termStart`.
        let cal = Calendar.current
        let startOfTerm = cal.startOfDay(for: startDate)
        let startOfNow = cal.startOfDay(for: now)
        let diffDays = cal.dateComponents([.day], from: startOfTerm, to: startOfNow).day ?? 0
        if diffDays < 0 { return 0 }
        return diffDays / 7 + 1
    }

    static func dayOfWeek(for date: Date) -> Int {
        let weekday = Calendar.current.component(.weekday, from: date)
        return weekday == 1 ? 7 : weekday - 1
    }

    static func tomorrowDayOfWeek(now: Date) -> Int {
        let today = dayOfWeek(for: now)
        return today == 7 ? 1 : today + 1
    }

    static func tomorrowWeek(termStart: String, now: Date) -> Int {
        let today = dayOfWeek(for: now)
        let week = currentWeek(termStart: termStart, now: now)
        return today == 7 ? week + 1 : week
    }

    static func weekStr(week: Int) -> String {
        String(format: WidgetStrings.localized("widget.weekDisplay"), week)
    }

    static func dateStr(for date: Date) -> String {
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

    static func todayCourses(from data: ScheduleWidgetData, now: Date) -> [WidgetCourse] {
        let week = currentWeek(termStart: data.termStart, now: now)
        let today = dayOfWeek(for: now)
        return data.courses
            .filter { $0.day == today && $0.weekStart <= week && $0.weekEnd >= week }
            .sorted { $0.sectionStart < $1.sectionStart }
    }

    static func tomorrowCourses(from data: ScheduleWidgetData, now: Date) -> [WidgetCourse] {
        let tWeek = tomorrowWeek(termStart: data.termStart, now: now)
        let tDay = tomorrowDayOfWeek(now: now)
        return data.courses
            .filter { $0.day == tDay && $0.weekStart <= tWeek && $0.weekEnd >= tWeek }
            .sorted { $0.sectionStart < $1.sectionStart }
    }

    static func upcomingTodayCourses(from data: ScheduleWidgetData, now: Date) -> [WidgetCourse] {
        let cal = Calendar.current
        let nowMin = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        return todayCourses(from: data, now: now).filter {
            parseTimeToMinutes($0.endTime) > nowMin
        }
    }
}
