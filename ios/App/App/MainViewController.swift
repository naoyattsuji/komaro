import Capacitor

/* アプリの中に書いた窓口は手で登録する（npm の部品は自動で登録される） */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AdTrackingGatePlugin())
    }
}
