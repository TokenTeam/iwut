import SwiftUI
import WidgetKit

struct ScheduleWidgetEntryView: View {
    var entry: ScheduleTimelineProvider.Entry

    private var displayCourses: [(course: WidgetCourse, isToday: Bool)] {
        entry.displayCourses
    }

    private var bottomText: String {
        guard entry.data != nil else { return "" }
        if displayCourses.isEmpty { return "" }

        let upcomingCount = entry.upcomingToday.count
        let tomorrowCount = entry.tomorrowCourses.count

        if upcomingCount == 0 && tomorrowCount == 0 {
            return WidgetStrings.localized("widget.bothDone")
        }

        let todayPart: String
        if upcomingCount == 0 {
            todayPart = WidgetStrings.localized("widget.todayDone")
        } else {
            let key = upcomingCount == 1
                ? "widget.todayRemaining.one"
                : "widget.todayRemaining.other"
            todayPart = String(format: WidgetStrings.localized(key), upcomingCount)
        }

        let tomorrowPart: String
        if tomorrowCount == 0 {
            tomorrowPart = WidgetStrings.localized("widget.tomorrowDone")
        } else {
            let key = tomorrowCount == 1
                ? "widget.tomorrowRemaining.one"
                : "widget.tomorrowRemaining.other"
            tomorrowPart = String(format: WidgetStrings.localized(key), tomorrowCount)
        }

        return todayPart + tomorrowPart
    }

    var body: some View {
        ZStack {
            WidgetBackgroundView(isEmpty: displayCourses.isEmpty)

            HStack(spacing: 12) {
                DateInfoView(
                    weekStr: entry.weekStr,
                    dateStr: entry.dateStr,
                    dayOfWeekStr: entry.dayOfWeekStr
                )

                VStack(alignment: .leading, spacing: 0) {
                    if displayCourses.isEmpty {
                        EmptyCourseView()
                    }

                    ForEach(displayCourses.indices, id: \.self) { index in
                        if index > 0 {
                            Divider()
                                .padding(.vertical, 8)
                        }
                        let item = displayCourses[index]
                        CourseInfoView(course: item.course, isToday: item.isToday)
                    }

                    if displayCourses.count == 1 {
                        Text(WidgetStrings.localized("widget.noMore"))
                            .foregroundColor(Color("TextPrimary"))
                            .font(.system(size: 12))
                            .padding(.top, 8)
                    }

                    Spacer()

                    if !bottomText.isEmpty {
                        Text(bottomText)
                            .foregroundColor(Color("TextSecondary"))
                            .font(.system(size: 12))
                    }
                }
            }
            .padding(16)
        }
    }
}
