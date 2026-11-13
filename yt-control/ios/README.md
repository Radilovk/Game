# YT Контрол за iPhone / iPad

Същото като Android приложението: m.youtube.com в собствено приложение с вградения модул YT Контрол.
Модулът се вкарва от приложението (WKUserScript, `.page`, при старта на документа), затова **не е нужно
да се включват разширения в Safari**: инсталираш и отваряш.

| | |
|---|---|
| Shorts | блокирани (и адресите `/shorts/…`) |
| Реклами | изрязани от данните + прескачане |
| Фоново слушане | аудио сесия `playback` + `UIBackgroundModes: audio`, контроли на заключения екран |
| Картина в картината | бутон в „Инструменти“ |
| Надписи | лист „Сподели“ → Запази във Файлове |
| Обновления на модула | автоматично от `radilovk.github.io/Game/yt-control/dist/yt-control.user.js` |
| Вход с Google профил | не (Google го забранява във вградени браузъри) |

## Качване в TestFlight (автоматично, без Mac)
Работният процес **„YT Контрол — iOS (TestFlight)“** в репото `aidiet` използва неговите Apple секрети:
сглобява проекта на macOS машина на GitHub, подписва го и го качва в App Store Connect → TestFlight.

Еднократно (само ти, в браузъра): **App Store Connect → Приложения → + → Ново приложение**:
iOS, име напр. „YT Контрол“, език Bulgarian, Bundle ID **com.biocode.ytkontrol**, SKU `yt-kontrol-1`.
(Bundle ID-то се регистрира от работния процес; приложение в App Store Connect не може да се създаде през API.)

После: **TestFlight → Вътрешно тестване → +** група и добави хората (трябва да са потребители в екипа ти).
Вътрешното тестване не минава през ревю. Всеки build важи 90 дни.

## Ръчно, от Mac
```bash
brew install xcodegen
cd yt-control/ios && xcodegen && open YTKontrol.xcodeproj
```
Xcode → целта YTKontrol → Signing & Capabilities → избери екипа → свържи iPhone → ▶.
