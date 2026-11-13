//
//  ModuleLoader.swift – YT Контрол (iOS)
//  Модулът е вграден в приложението, а новите версии се изтеглят от сайта и важат от следващото отваряне.
//  Така подобренията идват без нова версия на приложението – както в Android.
//

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking   // само за проверка на Linux; на iOS това е част от Foundation
#endif

enum ModuleLoader {
    static let updateURL = URL(string: "https://radilovk.github.io/Game/yt-control/dist/yt-control.user.js")!

    private static var cachedURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("yt-control.user.js")
    }

    private static var bundled: String {
        guard let url = Bundle.main.url(forResource: "yt-control.user", withExtension: "js"),
              let s = try? String(contentsOf: url, encoding: .utf8) else { return "" }
        return s
    }

    /// По-новата от вградената и последно изтеглената версия.
    static func script() -> String {
        let b = bundled
        if let c = try? String(contentsOf: cachedURL, encoding: .utf8), isValid(c), compare(version(c), version(b)) > 0 {
            return c
        }
        return b
    }

    /// Във фон проверява за нова версия; при успех връща номера ѝ.
    static func checkForUpdate(_ done: @escaping (String?) -> Void) {
        var req = URLRequest(url: updateURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
        req.httpMethod = "GET"
        URLSession.shared.dataTask(with: req) { data, resp, _ in
            guard let data = data, (resp as? HTTPURLResponse)?.statusCode == 200,
                  let fresh = String(data: data, encoding: .utf8), isValid(fresh),
                  compare(version(fresh), version(script())) > 0 else { return }
            do {
                try fresh.write(to: cachedURL, atomically: true, encoding: .utf8)
                DispatchQueue.main.async { done(version(fresh)) }
            } catch { }
        }.resume()
    }

    private static func isValid(_ s: String) -> Bool {
        s.contains("==UserScript==") && s.contains("YTC.pageHook") && s.contains("YTC_PAGE_HOOK")
    }

    static func version(_ s: String) -> String {
        guard let r = s.range(of: #"@version\s+[\d.]+"#, options: .regularExpression) else { return "0" }
        return s[r].split(whereSeparator: { $0 == " " || $0 == "\t" }).last.map(String.init) ?? "0"
    }

    static func compare(_ a: String, _ b: String) -> Int {
        let x = a.split(separator: ".").map { Int($0) ?? 0 }, y = b.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(x.count, y.count) {
            let p = i < x.count ? x[i] : 0, q = i < y.count ? y[i] : 0
            if p != q { return p < q ? -1 : 1 }
        }
        return 0
    }
}
