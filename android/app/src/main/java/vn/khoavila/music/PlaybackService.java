package vn.khoavila.music;

import android.app.PendingIntent;
import android.content.Intent;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Native background player. Media3 keeps the audio session alive with a media
 * notification and lock-screen controls while the app is not visible.
 */
public class PlaybackService extends MediaSessionService {
    public static final String CHANNEL_ID = "khoavila_playback";
    public static final int NOTIFICATION_ID = 1001;

    private ExoPlayer player;
    private MediaSession session;

    @Override
    public void onCreate() {
        super.onCreate();

        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .setUsage(C.USAGE_MEDIA)
                    .build(),
                true
            )
            .setHandleAudioBecomingNoisy(true)
            .build();

        session = new MediaSession.Builder(this, player)
            .setSessionActivity(openAppIntent())
            .build();

        DefaultMediaNotificationProvider provider = new DefaultMediaNotificationProvider.Builder(this)
            .setChannelId(CHANNEL_ID)
            .setChannelName(R.string.playback_channel_name)
            .setNotificationId(NOTIFICATION_ID)
            .build();
        provider.setSmallIcon(R.drawable.ic_khoavila);
        setMediaNotificationProvider(provider);
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        // Keep playing when the task is swiped away, but only if audio is active.
        if (player == null || !player.getPlayWhenReady() || player.getMediaItemCount() == 0) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        if (session != null) session.release();
        if (player != null) player.release();
        super.onDestroy();
    }

    private PendingIntent openAppIntent() {
        Intent intent = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
