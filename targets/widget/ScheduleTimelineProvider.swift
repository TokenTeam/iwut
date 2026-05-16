import WidgetKit

struct ScheduleEntry: TimelineEntry {
    let date: Date
    let data: ScheduleWidgetData?

    var upcomingToday: [WidgetCourse] {
        guard let data = data else { return [] }
        return ScheduleHelper.upcomingTodayCourses(from: data)
    }

    var tomorrowCourses: [WidgetCourse] {
        guard let data = data else { return [] }
        return ScheduleHelper.tomorrowCourses(from: data)
    }

    var displayCourses: [(course: WidgetCourse, isToday: Bool)] {
        let today = upcomingToday.map { ($0, true) }
        let tomorrow = tomorrowCourses.map { ($0, false) }
        return Array((today + tomorrow).prefix(2))
    }

    var weekStr: String {
        guard let data = data else { return WidgetStrings.localized("widget.weekUnknown") }
        return ScheduleHelper.weekStr(week: ScheduleHelper.currentWeek(termStart: data.termStart))
    }

    var dateStr: String {
        ScheduleHelper.dateStr(for: date)
    }

    var dayOfWeekStr: String {
        ScheduleHelper.dayOfWeekStr(day: ScheduleHelper.dayOfWeek(for: date))
    }
}

struct ScheduleTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScheduleEntry {
        ScheduleEntry(date: .now, data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (ScheduleEntry) -> Void) {
        let entry = ScheduleEntry(date: .now, data: ScheduleWidgetData.load())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ScheduleEntry>) -> Void) {
        let data = ScheduleWidgetData.load()
        var entries: [ScheduleEntry] = []

        entries.append(ScheduleEntry(date: .now, data: data))

        if let data = data {
            let todayCourses = ScheduleHelper.todayCourses(from: data)
            let calendar = Calendar.current

            for course in todayCourses {
                let parts = course.endTime.split(separator: ":")
                guard parts.count == 2,
                      let hour = Int(parts[0]),
                      let minute = Int(parts[1]),
                      let endDate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: .now),
                      endDate > .now
                else { continue }
                entries.append(ScheduleEntry(date: endDate, data: data))
            }
        }

        let nextMidnight = Calendar.current.startOfDay(
            for: Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now
        )
        entries.append(ScheduleEntry(date: nextMidnight, data: data))

        completion(Timeline(entries: entries, policy: .after(nextMidnight)))
    }
}
