import AppIntents
import Foundation

struct TodayCoursesIntent: AppIntent {
    static var title: LocalizedStringResource = "schedule.intent.todayTitle"
    static var description = IntentDescription("schedule.intent.description")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = ScheduleIntentResponse.text(for: .today, data: ScheduleWidgetData.load(), now: .now)
        return .result(value: text, dialog: "\(text)")
    }
}

struct TomorrowCoursesIntent: AppIntent {
    static var title: LocalizedStringResource = "schedule.intent.tomorrowTitle"
    static var description = IntentDescription("schedule.intent.description")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = ScheduleIntentResponse.text(for: .tomorrow, data: ScheduleWidgetData.load(), now: .now)
        return .result(value: text, dialog: "\(text)")
    }
}

struct NextCourseIntent: AppIntent {
    static var title: LocalizedStringResource = "schedule.intent.nextTitle"
    static var description = IntentDescription("schedule.intent.description")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = ScheduleIntentResponse.text(for: .next, data: ScheduleWidgetData.load(), now: .now)
        return .result(value: text, dialog: "\(text)")
    }
}
