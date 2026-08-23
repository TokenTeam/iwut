import ExpoModulesCore
import UIKit
import WidgetKit

public class DiagnosticsModule: Module {
    public func definition() -> ModuleDefinition {
        Name("Diagnostics")

        AsyncFunction("getNativeDiagnostics") { (promise: Promise) in
            let display = self.collectDisplayDiagnostics()

            WidgetCenter.shared.getCurrentConfigurations { result in
                switch result {
                case .success(let widgets):
                    let instances: [[String: Any]] = widgets.map { widget in
                        [
                            "kind": widget.kind,
                            "family": self.widgetFamilyName(widget.family),
                            "familyRawValue": widget.family.rawValue
                        ]
                    }
                    promise.resolve([
                        "platform": "ios",
                        "display": display,
                        "widgets": ["instances": instances]
                    ])
                case .failure(let error):
                    promise.reject(error)
                }
            }
        }.runOnQueue(.main)
    }

    private func collectDisplayDiagnostics() -> [String: Any] {
        let screen = UIScreen.main
        return [
            "boundsPoints": serialize(rect: screen.bounds),
            "nativeBoundsPixels": serialize(rect: screen.nativeBounds),
            "scale": Double(screen.scale),
            "nativeScale": Double(screen.nativeScale)
        ]
    }

    private func serialize(rect: CGRect) -> [String: Double] {
        [
            "x": Double(rect.origin.x),
            "y": Double(rect.origin.y),
            "width": Double(rect.size.width),
            "height": Double(rect.size.height)
        ]
    }

    private func widgetFamilyName(_ family: WidgetFamily) -> String {
        if family == .systemSmall { return "systemSmall" }
        if family == .systemMedium { return "systemMedium" }
        if family == .systemLarge { return "systemLarge" }
        if family == .systemExtraLarge { return "systemExtraLarge" }
        if family == .accessoryCircular { return "accessoryCircular" }
        if family == .accessoryRectangular { return "accessoryRectangular" }
        if family == .accessoryInline { return "accessoryInline" }
        return "unknown"
    }
}
