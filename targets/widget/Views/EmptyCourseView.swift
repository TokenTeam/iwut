import SwiftUI

struct EmptyCourseView: View {
    var body: some View {
        HStack(spacing: 0) {
            Text(WidgetStrings.localized("widget.allDone"))
                .foregroundColor(Color("TextPrimary"))
                .font(.system(size: 14))
                .padding(.leading, 8)
            Spacer()
        }
    }
}
