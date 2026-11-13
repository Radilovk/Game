//
//  ViewController.swift – YT Контрол (iOS)
//  Екранът на приложението: еднократна настройка + бутон "Отвори YouTube" (в Safari, където работи разширението).
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    private let autoKey = "autoOpenYouTube"
    private var shown = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.06, green: 0.06, blue: 0.063, alpha: 1)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.navigationDelegate = self
        webView.scrollView.isScrollEnabled = true
        webView.configuration.userContentController.add(self, name: "controller")
        webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!,
                            allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !shown else { return }
        shown = true
        let auto = UserDefaults.standard.bool(forKey: autoKey)
        webView.evaluateJavaScript("show(\(auto ? "true" : "false"))")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let msg = message.body as? String else { return }
        switch msg {
        case "open-youtube": openYouTubeInSafari()
        case "auto-on": UserDefaults.standard.set(true, forKey: autoKey)
        case "auto-off": UserDefaults.standard.set(false, forKey: autoKey)
        default: break
        }
    }

    /// Разширенията работят само в Safari, затова отваряме изрично Safari (x-safari-https),
    /// а ако това не стане – обикновения линк.
    private func openYouTubeInSafari() {
        let safari = URL(string: "x-safari-https://m.youtube.com/")!
        let plain = URL(string: "https://m.youtube.com/")!
        UIApplication.shared.open(safari, options: [:]) { ok in
            if !ok { UIApplication.shared.open(plain) }
        }
    }
}
