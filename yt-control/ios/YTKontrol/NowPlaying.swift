//
//  NowPlaying.swift – YT Контрол (iOS)
//  Заглавие и канал на заключения екран и в Центъра за управление; пусни/пауза оттам и от слушалките.
//

import Foundation
import MediaPlayer

final class NowPlaying {
    static let shared = NowPlaying()
    var onCommand: ((String) -> Void)?
    private var ready = false

    func update(playing: Bool, title: String, artist: String) {
        if !ready { setupCommands() }
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        if !title.isEmpty { info[MPMediaItemPropertyTitle] = title }
        info[MPMediaItemPropertyArtist] = artist
        info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func setupCommands() {
        ready = true
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.isEnabled = true
        c.pauseCommand.isEnabled = true
        c.togglePlayPauseCommand.isEnabled = true
        c.playCommand.addTarget { [weak self] _ in self?.send("play"); return .success }
        c.pauseCommand.addTarget { [weak self] _ in self?.send("pause"); return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in self?.send("toggle"); return .success }
        c.nextTrackCommand.isEnabled = false
        c.previousTrackCommand.isEnabled = false
    }

    private func send(_ cmd: String) {
        DispatchQueue.main.async { self.onCommand?(cmd) }
    }
}
