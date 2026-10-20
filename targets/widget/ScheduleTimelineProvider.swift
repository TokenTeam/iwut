import WidgetKit

struct ScheduleEntry: TimelineEntry {
    let date: Date
    let data: ScheduleWidgetData?

    var upcomingToday: [WidgetCourse] {
        guard let data = data else { return [] }
        return ScheduleHelper.upcomingTodayCourses(from: data, now: date)
    }

    var tomorrowCourses: [WidgetCourse] {
        guard let data = data else { return [] }
        return ScheduleHelper.tomorrowCourses(from: data, now: date)
    }

    var displayCourses: [(course: WidgetCourse, isToday: Bool)] {
        let today = upcomingToday.map { ($0, true) }
        let tomorrow = tomorrowCourses.map { ($0, false) }
        return Array((today + tomorrow).prefix(2))
    }

    var weekStr: String {
        guard let data = data else { return WidgetStrings.localized("widget.weekUnknown") }
        return ScheduleHelper.weekDisplayString(
            week: ScheduleHelper.currentWeek(termStart: data.termStart, now: date)
        )
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
        let now = Date()
        let calendar = ScheduleHelper.calendar
        let data = ScheduleWidgetData.load()

        var transitionDates: Set<Date> = []

        if let data = data {
            for course in ScheduleHelper.todayCourses(from: data, now: now) {
                let parts = course.endTime.split(separator: ":")
                guard parts.count == 2,
                      let hour = Int(parts[0]),
                      let minute = Int(parts[1]),
                      let endDate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: now),
                      endDate > now
                else { continue }
                transitionDates.insert(endDate)
            }
        }

        let nextMidnight = calendar.startOfDay(
            for: calendar.date(byAdding: .day, value: 1, to: now) ?? now
        )
        transitionDates.insert(nextMidnight)

        var entries: [ScheduleEntry] = [ScheduleEntry(date: now, data: data)]
        for transition in transitionDates.sorted() {
            entries.append(ScheduleEntry(date: transition, data: data))
        }

        completion(Timeline(entries: entries, policy: .after(nextMidnight)))
    }
}
