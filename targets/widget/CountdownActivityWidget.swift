import ActivityKit
import SwiftUI
import WidgetKit

struct CountdownActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CountdownActivityAttributes.self) { context in
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: min(Date.now, context.state.targetTime)...context.state.targetTime, countsDown: true)
                        .font(.title3.monospacedDigit())
                        .frame(width: 72)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Text(context.attributes.title)
                    .font(.caption2)
                    .lineLimit(1)
            } compactTrailing: {
                Text(context.attributes.subtitle)
                    .font(.caption2)
                    .lineLimit(1)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(.indigo)
            }
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<CountdownActivityAttributes>

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.title)
                    .font(.headline)
                    .lineLimit(1)
                Text(context.attributes.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(timerInterval: min(Date.now, context.state.targetTime)...context.state.targetTime, countsDown: true)
                .font(.title2.monospacedDigit())
                .foregroundStyle(.indigo)
                .multilineTextAlignment(.trailing)
        }
        .padding()
    }
}
