import SwiftUI

struct CourseInfoView: View {
    let course: WidgetCourse
    let isToday: Bool

    private var tagText: String {
        isToday
            ? WidgetStrings.localized("widget.today")
            : WidgetStrings.localized("widget.tomorrow")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(course.name)
                    .font(.system(size: 14))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .foregroundColor(Color("TextPrimary"))

                Text(tagText)
                    .font(.system(size: 10))
                    .foregroundColor(Color("AccentBlue"))
                    .fontWeight(.bold)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(Color("AccentBlue"), lineWidth: 1)
                    )
            }

            HStack(alignment: .bottom, spacing: 0) {
                Text(course.room.isEmpty
                    ? WidgetStrings.localized("widget.noRoom")
                    : course.room)
                    .font(.system(size: 12))
                    .lineLimit(2)
                    .foregroundColor(Color("TextSecondary"))
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 4)

                Text("|")
                    .font(.system(size: 12))
                    .foregroundColor(Color("TextSecondary"))
                    .padding(.trailing, 4)

                Text("\(course.startTime)-\(course.endTime)")
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(1)
                    .font(.system(size: 12).monospacedDigit())
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
    }
}
