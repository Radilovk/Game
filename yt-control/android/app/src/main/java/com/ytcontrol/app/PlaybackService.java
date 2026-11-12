package com.ytcontrol.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

/**
 * Фоново слушане: докато видео свири, приложението стои „на преден план“ с известие
 * (заглавие, канал, бутони пауза/пусни), контроли на заключения екран и от слушалките.
 * Така Android не спира звука при заключен екран или когато ползваш други приложения.
 */
public class PlaybackService extends Service {

    static final String ACTION_UPDATE = "com.ytcontrol.app.UPDATE";
    static final String ACTION_TOGGLE = "com.ytcontrol.app.TOGGLE";
    static final String ACTION_CLOSE = "com.ytcontrol.app.CLOSE";
    private static final String CHANNEL = "playback";
    private static final int NOTIF_ID = 7;
    private static final long IDLE_STOP_MS = 10 * 60 * 1000; // 10 мин на пауза → известието може да се махне

    /** Командите (пусни/пауза) отиват към страницата през тази връзка. */
    interface Controller { void command(String cmd); }
    static Controller controller;

    private MediaSession session;
    private PowerManager.WakeLock wake;
    private WifiManager.WifiLock wifi;
    private boolean playing;
    private String title = "", artist = "";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable idleStop = () -> { stopForeground(STOP_FOREGROUND_DETACH); releaseLocks(); };

    static void update(Context ctx, boolean playing, String title, String artist) {
        Intent i = new Intent(ctx, PlaybackService.class).setAction(ACTION_UPDATE)
                .putExtra("playing", playing).putExtra("title", title).putExtra("artist", artist);
        try {
            if (playing && Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
        } catch (Exception ignored) { /* Android може да откаже старт от фона – следващото известие ще успее */ }
    }

    static void stop(Context ctx) { ctx.stopService(new Intent(ctx, PlaybackService.class)); }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Възпроизвеждане", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Контроли при слушане във фонов режим");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        session = new MediaSession(this, "YTControl");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { send("play"); }
            @Override public void onPause() { send("pause"); }
            @Override public void onStop() { send("pause"); }
        });
        session.setActive(true);
        PowerManager pm = getSystemService(PowerManager.class);
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "YTControl:playback");
        wake.setReferenceCounted(false);
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifi = wm.createWifiLock(Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_HIGH_PERF : WifiManager.WIFI_MODE_FULL, "YTControl:wifi");
            wifi.setReferenceCounted(false);
        }
    }

    private void send(String cmd) {
        Controller c = controller;
        if (c != null) c.command(cmd);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent == null ? null : intent.getAction();
        if (ACTION_TOGGLE.equals(a)) { send(playing ? "pause" : "play"); return START_NOT_STICKY; }
        if (ACTION_CLOSE.equals(a)) { send("pause"); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY; }
        if (ACTION_UPDATE.equals(a)) {
            playing = intent.getBooleanExtra("playing", false);
            String t = intent.getStringExtra("title"), ar = intent.getStringExtra("artist");
            if (t != null && !t.isEmpty()) title = t;
            if (ar != null) artist = ar;
        }
        Notification n = build();
        if (playing) {
            handler.removeCallbacks(idleStop);
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTIF_ID, n);
            if (!wake.isHeld()) wake.acquire(6 * 60 * 60 * 1000L);
            if (wifi != null && !wifi.isHeld()) wifi.acquire();
        } else {
            getSystemService(NotificationManager.class).notify(NOTIF_ID, n);
            handler.removeCallbacks(idleStop);
            handler.postDelayed(idleStop, IDLE_STOP_MS);
            releaseLocks();
        }
        updateSession();
        return START_NOT_STICKY;
    }

    private void updateSession() {
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .build());
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build());
    }

    private Notification build() {
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), fl);
        PendingIntent toggle = PendingIntent.getService(this, 1, new Intent(this, PlaybackService.class).setAction(ACTION_TOGGLE), fl);
        PendingIntent close = PendingIntent.getService(this, 2, new Intent(this, PlaybackService.class).setAction(ACTION_CLOSE), fl);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title.isEmpty() ? "YT Контрол" : title)
                .setContentText(artist)
                .setContentIntent(open)
                .setDeleteIntent(close)
                .setOngoing(playing)
                .setShowWhen(false)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0));
        // иконки на бутоните (системните на Android)
        b.setActions(
                new Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(this,
                        playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play), playing ? "Пауза" : "Пусни", toggle).build(),
                new Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(this,
                        android.R.drawable.ic_menu_close_clear_cancel), "Затвори", close).build());
        return b.build();
    }

    private void releaseLocks() {
        if (wake != null && wake.isHeld()) wake.release();
        if (wifi != null && wifi.isHeld()) wifi.release();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(idleStop);
        releaseLocks();
        session.setActive(false);
        session.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
