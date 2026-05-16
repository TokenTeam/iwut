import SwiftUI
import WidgetKit

struct ScheduleWidget: Widget {
    let kind: String = "ScheduleWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScheduleTimelineProvider()) { entry in
            if #available(iOS 17.0, *) {
                ScheduleWidgetEntryView(entry: entry)
                    .containerBackground(Color("WidgetBackground"), for: .widget)
            } else {
                ScheduleWidgetEntryView(entry: entry)
                    .background(Color("WidgetBackground"))
            }
        }
        .safeContentMarginsDisabled()
        // configurationDisplayName / description show in the system widget
        // gallery and cannot read App Group preferences (the widget is not
        // instantiated yet). Resolve via standard bundle lookup so they
        // follow the device locale instead.
        .configurationDisplayName(LocalizedStringKey("widget.displayName"))
        .description(LocalizedStringKey("widget.description"))
        .supportedFamilies([.systemMedium])
    }
}

extension WidgetConfiguration {
    func safeContentMarginsDisabled() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}
