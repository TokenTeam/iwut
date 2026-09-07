import SwiftUI
import WidgetKit

struct ScheduleSmallWidgetEntryView: View {
    let entry: ScheduleTimelineProvider.Entry

    private var week: Int? {
        guard let data = entry.data else { return nil }
        return ScheduleHelper.rawWeek(termStart: data.termStart, now: entry.date)
    }

    private var displayCourse: (course: WidgetCourse, isToday: Bool)? {
        guard week != nil else { return nil }
        return entry.displayCourses.first
    }

    private var bottomText: String {
        guard let item = displayCourse else { return "" }
        let count = item.isToday ? entry.upcomingToday.count : entry.tomorrowCourses.count
        let key: String
        if item.isToday {
            key = count == 1
                ? "widget.smallTodayRemaining.one"
                : "widget.smallTodayRemaining.other"
        } else {
            key = count == 1
                ? "widget.smallTomorrowTotal.one"
                : "widget.smallTomorrowTotal.other"
        }
        return String(format: WidgetStrings.localized(key), count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(week.map { ScheduleHelper.weekDisplayString(week: $0) } ?? "")
                    .foregroundColor(Color("AccentBlue"))
                    .font(.system(size: 12))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                if let item = displayCourse {
                    Text(WidgetStrings.localized(item.isToday ? "widget.today" : "widget.tomorrow"))
                        .foregroundColor(.white)
                        .font(.system(size: 11))
                        .lineLimit(1)
                        .padding(.horizontal, 10)
                        .frame(height: 22)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color("AccentBlue"))
                        )
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            .frame(height: 22)

            if let item = displayCourse {
                VStack(alignment: .leading, spacing: 5) {
                    Text(item.course.name)
                        .foregroundColor(Color("TextPrimary"))
                        .font(.system(size: 17, weight: .bold))

                    Text("\(item.course.startTime) - \(item.course.endTime)")
                        .foregroundColor(Color("TextSecondary"))
                        .font(.system(size: 13).monospacedDigit())

                    Text(item.course.room)
                        .foregroundColor(Color("TextSecondary"))
                        .font(.system(size: 12))
                }
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.top, 8)
            } else {
                Text(WidgetStrings.localized("widget.noMore"))
                    .foregroundColor(Color("TextPrimary"))
                    .font(.system(size: 15))
                    .lineLimit(2)
                    .padding(.top, 10)
            }

            Spacer(minLength: 0)

            if !bottomText.isEmpty {
                Text(bottomText)
                    .foregroundColor(Color("TextSecondary"))
                    .font(.system(size: 11))
                    .lineLimit(1)
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(14)
        .background(alignment: .bottomTrailing) {
            Image("SmallBackgroundLogo")
                .renderingMode(.original)
                .resizable()
                .scaledToFit()
                .frame(width: 94.4, height: 112)
                .opacity(0.55)
                .accessibilityHidden(true)
        }
    }
}
