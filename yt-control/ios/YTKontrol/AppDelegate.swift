//
//  AppDelegate.swift – YT Контрол (iOS)
//  Мобилният YouTube в собствено приложение с вградения модул YT Контрол – същото като Android приложението.
//

import UIKit
import AVFoundation

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Аудио сесия "възпроизвеждане": звукът продължава при заключен екран и в други приложения,
        // и не се спира от превключвателя за тих режим.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback, options: [])
        try? session.setActive(true)

        let w = UIWindow(frame: UIScreen.main.bounds)
        w.rootViewController = WebViewController()
        w.makeKeyAndVisible()
        window = w
        return true
    }

    /// ytkontrol://watch?v=ID  или  ytkontrol://https://youtu.be/ID  (за Преки пътища / други приложения)
    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        (window?.rootViewController as? WebViewController)?.openExternal(url)
        return true
    }
}
