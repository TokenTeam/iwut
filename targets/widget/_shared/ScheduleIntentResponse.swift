import Foundation

enum ScheduleIntentResponse {
    enum Query {
        case today, tomorrow, next
    }

    static func text(
        for query: Query,
        data: ScheduleWidgetData?,
        now: Date,
        localized: (String) -> String = WidgetStrings.localized
    ) -> String {
        guard let data, data.hasValidCourseList else {
            return localized("schedule.intent.noData")
        }
        let date = query == .tomorrow
            ? ScheduleHelper.calendar.date(byAdding: .day, value: 1, to: now) ?? now
            : now
        guard let week = ScheduleHelper.rawWeek(termStart: data.termStart, now: date) else {
            return localized("schedule.intent.invalidTerm")
        }
        guard (1...ScheduleHelper.maxWeek).contains(week) else {
            return localized("schedule.intent.vacation")
        }
        let courses = ScheduleHelper.todayCourses(from: data, now: date)
        let heading: String
        let selected: [WidgetCourse]
        switch query {
        case .today:
            guard !courses.isEmpty else { return localized("schedule.intent.noToday") }
            heading = localized("schedule.intent.todayHeading")
            selected = courses
        case .tomorrow:
            guard !courses.isEmpty else { return localized("schedule.intent.noTomorrow") }
            heading = localized("schedule.intent.tomorrowHeading")
            selected = courses
        case .next:
            guard courses.allSatisfy({
                guard let start = ScheduleHelper.timeToMinutes($0.startTime),
                      let end = ScheduleHelper.timeToMinutes($0.endTime) else { return false }
                return start < end
            }) else { return localized("schedule.intent.noData") }
            guard let course = ScheduleHelper.upcomingTodayCourses(from: data, now: now).first else {
                return localized("schedule.intent.noNext")
            }
            let calendar = ScheduleHelper.calendar
            let minute = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
            let ongoing = ScheduleHelper.parseTimeToMinutes(course.startTime) <= minute
            heading = localized(ongoing ? "schedule.intent.ongoingHeading" : "schedule.intent.nextHeading")
            selected = [course]
        }
        let lines = selected.map { course in
            String(
                format: localized("schedule.intent.course"),
                course.name.isEmpty ? localized("schedule.intent.unknownName") : course.name,
                ScheduleHelper.timeToMinutes(course.startTime) == nil
                    ? localized("schedule.intent.unknownTime") : course.startTime,
                ScheduleHelper.timeToMinutes(course.endTime) == nil
                    ? localized("schedule.intent.unknownTime") : course.endTime,
                course.room.isEmpty ? localized("widget.noRoom") : course.room
            )
        }
        return ([heading] + lines).joined(separator: "\n")
    }
}
