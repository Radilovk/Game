package com.ytcontrol.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * YT Контрол – мобилният YouTube (m.youtube.com) в собствено приложение.
 *
 * Модулът (същият JS като за iPhone) се вкарва в страницата от самата система
 * (addDocumentStartJavaScript) – преди кода на YouTube и без да зависи от CSP на сайта.
 * Мрежови заявки НЕ се блокират: YouTube разпознава блокерите по тях и нарочно забавя видеото.
 * Рекламите се махат от данните, а ако мине някоя – прескача се за миг.
 */
public class MainActivity extends Activity {

    private static final String HOME = "https://m.youtube.com/";
    private static final String SCRIPT_ASSET = "yt-control.user.js";
    private static final String UPDATE_URL = "https://radilovk.github.io/Game/yt-control/dist/yt-control.user.js";

    private FrameLayout root;
    private WebView web;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private boolean docStartInjected = false;
    private String script = "";
    private final Handler ui = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0F0F0F"));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);               // настройките на модула се пазят в localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        // Същият двигател като Chrome (Android System WebView). Махаме маркера "wv",
        // за да получим същата бърза версия на сайта, която получава Chrome.
        s.setUserAgentString(s.getUserAgentString().replace("; wv)", ")").replace(" Version/4.0", ""));
        s.setOffscreenPreRaster(true);              // по-плавен скрол – WebView е целият екран
        web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        script = loadScript();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, script, Collections.singleton("https://m.youtube.com"));
            docStartInjected = true;
        }

        web.addJavascriptInterface(new Bridge(), "YTCApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(resolve(getIntent()));

        checkForScriptUpdate();
        if (savedInstanceState == null) ui.postDelayed(this::maybeAskOpenLinks, 2500);
    }

    // ---------------------------------------------------------------- линкове по подразбиране

    /**
     * Еднократно предлага YouTube линковете (от чатове, Google и др.) да се отварят тук,
     * а не в официалното приложение YouTube.
     */
    private void maybeAskOpenLinks() {
        android.content.SharedPreferences p = getSharedPreferences("ytc", MODE_PRIVATE);
        if (p.getBoolean("askedLinks", false) || isFinishing()) return;
        p.edit().putBoolean("askedLinks", true).apply();
        new android.app.AlertDialog.Builder(this)
                .setTitle("Отваряй YouTube линковете тук")
                .setMessage("Така линковете от чатове и сайтове ще се отварят в YT Контрол (без Shorts и реклами), а не в приложението YouTube.\n\n"
                        + "На следващия екран натисни „Добавяне на връзка“ и отметни всички адреси на YouTube.")
                .setPositiveButton("Настрой", (d, w) -> openLinkSettings())
                .setNegativeButton("По-късно", null)
                .show();
    }

    /** Мост за панела 🛡 в страницата. Само едно безопасно действие – отваряне на системна настройка. */
    private class Bridge {
        @android.webkit.JavascriptInterface
        public void openLinkSettings() { ui.post(MainActivity.this::openLinkSettings); }
    }

    private void openLinkSettings() {
        Intent i;
        if (android.os.Build.VERSION.SDK_INT >= 31) {
            i = new Intent(android.provider.Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS, Uri.parse("package:" + getPackageName()));
        } else {
            i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
        }
        try { startActivity(i); } catch (ActivityNotFoundException e) {
            try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
            catch (ActivityNotFoundException ignored) { }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String url = resolve(intent);
        if (url != null && !url.equals(HOME)) web.loadUrl(url);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }

    @Override
    protected void onDestroy() { web.destroy(); super.onDestroy(); }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (customView != null) { hideCustomView(); return; }
        if (web.canGoBack()) { web.goBack(); return; }
        super.onBackPressed();
    }

    // ---------------------------------------------------------------- линкове

    /** Превръща входящ линк (VIEW или споделен текст) в адрес на m.youtube.com. */
    private String resolve(Intent intent) {
        if (intent == null) return HOME;
        Uri uri = intent.getData();
        if (uri == null && Intent.ACTION_SEND.equals(intent.getAction())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text != null) {
                Matcher m = Pattern.compile("https?://\\S+").matcher(text);
                if (m.find()) uri = Uri.parse(m.group());
            }
        }
        if (uri == null) return HOME;
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        String path = uri.getPath() == null ? "/" : uri.getPath();
        if (host.equals("youtu.be")) {
            String id = path.replaceFirst("^/", "");
            return id.isEmpty() ? HOME : "https://m.youtube.com/watch?v=" + id;
        }
        if (!isYouTube(host)) return HOME;
        if (isShorts(path)) { toast("🚫 Shorts е блокиран"); return HOME; }
        return uri.buildUpon().scheme("https").authority("m.youtube.com").build().toString();
    }

    private static boolean isYouTube(String host) {
        return host.equals("youtube.com") || host.endsWith(".youtube.com") || host.equals("youtu.be");
    }

    private static boolean isShorts(String path) {
        return path != null && path.matches("^/shorts(/.*)?$");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException ignored) { }
    }

    private void toast(String msg) {
        ui.post(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
    }

    // ---------------------------------------------------------------- WebView клиент


    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase();

            // опити да се отвори официалното приложение YouTube – спираме ги
            if (scheme.equals("intent") || scheme.equals("vnd.youtube") || scheme.equals("youtube")) return true;
            if (!scheme.startsWith("http")) { openExternal(u); return true; }

            if (isYouTube(host)) {
                if (isShorts(u.getPath())) { toast("🚫 Shorts е блокиран"); return true; }
                if (!host.equals("m.youtube.com")) { view.loadUrl(resolve(new Intent(Intent.ACTION_VIEW, u))); return true; }
                return false;
            }
            if (host.equals("accounts.google.com") || host.endsWith(".accounts.google.com")) {
                toast("Вход с Google профил не се поддържа във вградени приложения");
                return true;
            }
            if (host.equals("consent.youtube.com") || host.equals("consent.google.com")) return false;
            openExternal(u); // външни линкове – в браузъра
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            // Стари WebView без DOCUMENT_START_SCRIPT: вкарваме модула възможно най-рано
            if (!docStartInjected && url != null && url.startsWith("https://m.youtube.com")) {
                view.evaluateJavascript(script, null);
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, android.webkit.WebResourceError err) {
            if (req.isForMainFrame()) {
                String html = "<html><head><meta name=viewport content='width=device-width,initial-scale=1'></head>"
                        + "<body style='background:#0f0f0f;color:#eee;font-family:sans-serif;display:flex;flex-direction:column;"
                        + "align-items:center;justify-content:center;height:90vh;text-align:center'>"
                        + "<div style='font-size:48px'>📡</div><h2>Няма връзка</h2><p style='color:#999'>Провери интернета и опитай пак.</p>"
                        + "<a href='" + HOME + "' style='background:#ff0033;color:#fff;padding:14px 26px;border-radius:12px;"
                        + "text-decoration:none;font-weight:bold;margin-top:12px'>Опитай отново</a></body></html>";
                view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
            }
        }
    }

    // ---------------------------------------------------------------- видео на цял екран

    private class Chrome extends WebChromeClient {
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) { callback.onCustomViewHidden(); return; }
            customView = view;
            customCallback = callback;
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            web.setVisibility(View.GONE);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            setFullscreen(true);
        }

        @Override
        public void onHideCustomView() { hideCustomView(); }

        @Override
        public Bitmap getDefaultVideoPoster() {
            // без сивата иконка "play", която WebView показва по подразбиране
            return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
        }
    }

    private void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        web.setVisibility(View.VISIBLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        setFullscreen(false);
        if (customCallback != null) customCallback.onCustomViewHidden();
        customCallback = null;
    }

    @SuppressWarnings("deprecation")
    private void setFullscreen(boolean on) {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c == null) return;
            if (on) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else {
                c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(on
                    ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    : View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    // ---------------------------------------------------------------- модулът и обновяването му

    /** Взима по-новата версия от вградената и последно изтеглената. */
    private String loadScript() {
        String bundled = readAsset();
        File cached = new File(getFilesDir(), SCRIPT_ASSET);
        if (cached.exists()) {
            try (InputStream in = new java.io.FileInputStream(cached)) {
                String c = readAll(in);
                if (isValid(c) && compare(version(c), version(bundled)) > 0) return c;
            } catch (Exception ignored) { }
        }
        return bundled;
    }

    /** Във фон проверява за нова версия на модула. Ще се ползва при следващото отваряне на приложението. */
    private void checkForScriptUpdate() {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(UPDATE_URL).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setUseCaches(false);
                if (c.getResponseCode() != 200) return;
                String fresh;
                try (InputStream in = c.getInputStream()) { fresh = readAll(in); }
                if (!isValid(fresh) || compare(version(fresh), version(script)) <= 0) return;
                File tmp = new File(getFilesDir(), SCRIPT_ASSET + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(fresh.getBytes(StandardCharsets.UTF_8)); }
                if (tmp.renameTo(new File(getFilesDir(), SCRIPT_ASSET))) {
                    toast("YT Контрол е обновен до v" + version(fresh) + " – важи от следващото отваряне");
                }
            } catch (Exception ignored) { }
        }).start();
    }

    private static boolean isValid(String s) {
        return s != null && s.contains("==UserScript==") && s.contains("YTC.pageHook") && s.contains("YTC_PAGE_HOOK");
    }

    private static String version(String s) {
        Matcher m = Pattern.compile("@version\\s+([\\d.]+)").matcher(s == null ? "" : s);
        return m.find() ? m.group(1) : "0";
    }

    private static int compare(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? parse(x[i]) : 0, q = i < y.length ? parse(y[i]) : 0;
            if (p != q) return Integer.compare(p, q);
        }
        return 0;
    }

    private static int parse(String s) { try { return Integer.parseInt(s); } catch (Exception e) { return 0; } }

    private String readAsset() {
        try (InputStream in = getAssets().open(SCRIPT_ASSET)) { return readAll(in); }
        catch (Exception e) { return ""; }
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return bo.toString("UTF-8");
    }
}
