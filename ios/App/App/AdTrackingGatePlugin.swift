import Capacitor
import UIKit

/*
 * ATT の前に使う窓口。アプリが active になるのを待ち、端末の地域を返す。
 * ATT の画面は active の間にしか出ないため。
 * この窓口があること自体が「ATT の説明文が入った版」の印にもなる（lib/adTracking.ts）。
 */
@objc(AdTrackingGatePlugin)
public class AdTrackingGatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AdTrackingGatePlugin"
    public let jsName = "AdTrackingGate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "whenActive", returnType: CAPPluginReturnPromise),
    ]

    private var observer: NSObjectProtocol?

    @objc func whenActive(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if UIApplication.shared.applicationState == .active {
                self.answer(call)
                return
            }
            self.observer = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
                self.observer = nil
                self.answer(call)
            }
        }
    }

    private func answer(_ call: CAPPluginCall) {
        call.resolve(["region": Locale.current.regionCode ?? ""])
    }
}
