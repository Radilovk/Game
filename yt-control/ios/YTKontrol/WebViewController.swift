//
//  WebViewController.swift – YT Контрол (iOS)
//
//  m.youtube.com в WKWebView. Модулът YT Контрол се вкарва като WKUserScript при старта на всеки документ,
//  директно в страницата (.page) – преди кода на YouTube и независимо от CSP на сайта.
//  Същото поведение като Android приложението: блокиране на Shorts адреси, външни линкове в Safari,
//  слушане във фонов режим с контроли на заключения екран, запазване на надписи, картина в картината.
//

import UIKit
import WebKit

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    private var webView: WKWebView!
    private let home = URL(string: "https://m.youtube.com/")!
    private var isPlaying = false
    private var pendingURL: URL?
    private var loadedOnce = false

    // Мост към модула: в Android това е addJavascriptInterface("YTCApp"), тук – messageHandlers.ytc
    private static let bridgeJS = """
    (function () {
      if (window.YTCApp) return;
      var post = function (o) { try { window.webkit.messageHandlers.ytc.postMessage(o); } catch (e) {} };
      window.YTCApp = {
        platform: 'ios',
        media: function (playing, title, artist) { post({ cmd: 'media', playing: !!playing, title: String(title || ''), artist: String(artist || '') }); },
        saveFile: function (name, mime, content) { post({ cmd: 'save', name: String(name || 'file.txt'), mime: String(mime || 'text/plain'), content: String(content || '') }); }
      };
    })();
    """

    // MARK: - Изглед

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.allowsPictureInPictureMediaPlayback = true
        cfg.allowsAirPlayForMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.websiteDataStore = .default()          // настройки, история, абонаменти – пазят се между стартиранията
        // Представяме се като Safari, за да получим същата версия на сайта като в браузъра
        let major = UIDevice.current.systemVersion.split(separator: ".").first.map(String.init) ?? "18"
        cfg.applicationNameForUserAgent = "Version/\(major).0 Safari/604.1"

        let ucc = cfg.userContentController
        ucc.addUserScript(WKUserScript(source: Self.bridgeJS, injectionTime: .atDocumentStart,
                                       forMainFrameOnly: true, in: .page))
        ucc.addUserScript(WKUserScript(source: ModuleLoader.script(), injectionTime: .atDocumentStart,
                                       forMainFrameOnly: true, in: .page))
        ucc.add(WeakMessageHandler(self), contentWorld: .page, name: "ytc")

        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true   // жест "назад" от левия край
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        let root = UIView()
        root.backgroundColor = .systemBackground
        root.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor),
        ])
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        NowPlaying.shared.onCommand = { [weak self] cmd in self?.mediaCommand(cmd) }

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(didEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(willEnterForeground), name: UIApplication.willEnterForegroundNotification, object: nil)

        webView.load(URLRequest(url: pendingURL ?? home))
        pendingURL = nil
        loadedOnce = true

        ModuleLoader.checkForUpdate { [weak self] version in
            guard let v = version else { return }
            self?.toast("YT Контрол е обновен до v\(v) – важи от следващото отваряне")
        }
    }

    // MARK: - Входящи линкове (ytkontrol://…)

    func openExternal(_ url: URL) {
        var target: URL?
        if url.scheme == "ytkontrol" {
            let rest = url.absoluteString.replacingOccurrences(of: "ytkontrol://", with: "")
            if rest.hasPrefix("http"), let u = URL(string: rest) { target = mobileURL(for: u) }
            else if let u = URL(string: "https://m.youtube.com/" + rest) { target = u }
        } else {
            target = mobileURL(for: url)
        }
        guard let t = target else { return }
        if loadedOnce { webView.load(URLRequest(url: t)) } else { pendingURL = t }
    }

    /// youtube.com / youtu.be → m.youtube.com; Shorts → nil (блокирани)
    private func mobileURL(for url: URL) -> URL? {
        guard let host = url.host?.lowercased() else { return nil }
        if host == "youtu.be" {
            let id = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            return id.isEmpty ? home : URL(string: "https://m.youtube.com/watch?v=\(id)")
        }
        guard host == "youtube.com" || host.hasSuffix(".youtube.com") else { return nil }
        if isShorts(url.path) { return nil }
        var c = URLComponents(url: url, resolvingAgainstBaseURL: false)
        c?.scheme = "https"
        c?.host = "m.youtube.com"
        return c?.url
    }

    private func isShorts(_ path: String) -> Bool {
        path == "/shorts" || path.hasPrefix("/shorts/")
    }

    // MARK: - Навигация

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        let scheme = url.scheme?.lowercased() ?? ""
        let host = url.host?.lowercased() ?? ""
        let mainFrame = action.targetFrame?.isMainFrame ?? true

        // опити да се отвори официалното приложение YouTube – спираме ги
        if ["intent", "vnd.youtube", "youtube", "youtubeapp"].contains(scheme) { return decisionHandler(.cancel) }
        if scheme == "about" || scheme == "blob" || scheme == "data" { return decisionHandler(.allow) }
        if scheme != "http" && scheme != "https" {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        if !mainFrame { return decisionHandler(.allow) }   // вградени рамки на самия YouTube

        if host == "m.youtube.com" {
            if isShorts(url.path) { toast("🚫 Shorts е блокиран"); return decisionHandler(.cancel) }
            return decisionHandler(.allow)
        }
        if host == "youtu.be" || host == "youtube.com" || host.hasSuffix(".youtube.com") {
            if let m = mobileURL(for: url) { webView.load(URLRequest(url: m)) } else { toast("🚫 Shorts е блокиран") }
            return decisionHandler(.cancel)
        }
        if host == "consent.youtube.com" || host == "consent.google.com" { return decisionHandler(.allow) }
        if host == "accounts.google.com" || host.hasSuffix(".accounts.google.com") {
            alert("Вход с профил", "Google не позволява вход с профил във вградени приложения. Гледането, търсенето и всички функции на YT Контрол работят и без профил – вкл. абонаменти и история.")
            return decisionHandler(.cancel)
        }
        // всичко останало (външни сайтове) – в Safari
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    // target="_blank"
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if let m = mobileURL(for: url) { webView.load(URLRequest(url: m)) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled || code == 102 /* прекъснато от нас */ { return }
        webView.loadHTMLString(Self.offlineHTML, baseURL: nil)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()   // iOS може да спре процеса на страницата при липса на памет
    }

    private static let offlineHTML = """
    <html><head><meta name=viewport content='width=device-width,initial-scale=1'></head>
    <body style='background:#0f0f0f;color:#eee;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;
    align-items:center;justify-content:center;height:90vh;text-align:center'>
    <div style='font-size:48px'>📡</div><h2>Няма връзка</h2><p style='color:#999'>Провери интернета и опитай пак.</p>
    <a href='https://m.youtube.com/' style='background:#ff0033;color:#fff;padding:14px 26px;border-radius:12px;
    text-decoration:none;font-weight:bold;margin-top:12px'>Опитай отново</a></body></html>
    """

    // MARK: - Мост от модула

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // само от главната страница на m.youtube.com
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == "m.youtube.com",
              let body = message.body as? [String: Any],
              let cmd = body["cmd"] as? String else { return }
        switch cmd {
        case "media":
            isPlaying = body["playing"] as? Bool ?? false
            NowPlaying.shared.update(playing: isPlaying,
                                     title: body["title"] as? String ?? "",
                                     artist: body["artist"] as? String ?? "")
        case "save":
            saveFile(name: body["name"] as? String ?? "captions.srt", content: body["content"] as? String ?? "")
        default:
            break
        }
    }

    private func mediaCommand(_ cmd: String) {
        let safe = cmd.filter { $0.isLetter }
        webView.evaluateJavaScript("window.YTC && YTC.mediaCommand && YTC.mediaCommand('\(safe)')")
    }

    /// Надписи → лист "Сподели" (Запази във Файлове, AirDrop, Бележки…)
    private func saveFile(name: String, content: String) {
        let bad = CharacterSet(charactersIn: "/\\\\:*?\"<>|")
        var clean = name.components(separatedBy: bad).joined(separator: " ").trimmingCharacters(in: .whitespaces)
        if clean.isEmpty { clean = "captions.srt" }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(clean)
        do {
            try ("\u{FEFF}" + content).write(to: url, atomically: true, encoding: .utf8)
        } catch {
            toast("Файлът не можа да се запази"); return
        }
        let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let pop = vc.popoverPresentationController {   // iPad
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
        }
        present(vc, animated: true)
    }

    // MARK: - Фонов режим

    @objc private func didEnterBackground() {
        // модулът подновява видеото, ако iOS го спре при излизане (само ако не си го спрял ти)
        webView.evaluateJavaScript("window.__ytcBg = true")
    }

    @objc private func willEnterForeground() {
        webView.evaluateJavaScript("window.__ytcBg = false")
    }

    // MARK: - Помощни

    private func toast(_ text: String) {
        let js = "window.YTC && YTC.toast && YTC.toast(\(Self.jsString(text)))"
        DispatchQueue.main.async { self.webView.evaluateJavaScript(js) }
    }

    private func alert(_ title: String, _ text: String) {
        let a = UIAlertController(title: title, message: text, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Добре", style: .default))
        present(a, animated: true)
    }

    private static func jsString(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [s])
        let arr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(arr.dropFirst().dropLast())
    }
}

/// Слаба връзка – WKUserContentController държи силно своите handler-и.
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(c, didReceive: message)
    }
}
