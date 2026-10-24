package vn.khoavila.music;

import android.content.ComponentName;
import android.net.Uri;

import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

/**
 * Controls the native Media3 session so audio keeps playing when the WebView is
 * not visible.
 */
@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin implements Player.Listener {
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;

    @Override
    public void load() {
        SessionToken token = new SessionToken(
            getContext(),
            new ComponentName(getContext(), PlaybackService.class)
        );
        controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                controller.addListener(NativeAudioPlugin.this);
            } catch (Exception ignored) {
                controller = null;
            }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    @Override
    protected void handleOnDestroy() {
        if (controller != null) {
            controller.removeListener(this);
            controller.release();
            controller = null;
        }
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void setTrack(PluginCall call) {
        MediaController player = controller;
        if (player == null) {
            call.reject("Trình phát nền chưa sẵn sàng.");
            return;
        }
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Thiếu đường dẫn audio.");
            return;
        }
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String artwork = call.getString("artwork");
        Double position = call.getDouble("positionMs", 0d);

        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist);
        if (artwork != null && !artwork.isEmpty()) {
            metadata.setArtworkUri(Uri.parse(artwork));
        }

        MediaItem item = new MediaItem.Builder()
            .setUri(url)
            .setMediaMetadata(metadata.build())
            .build();

        ContextCompat.getMainExecutor(getContext()).execute(() -> {
            player.setMediaItem(item);
            player.prepare();
            if (position != null && position > 0) player.seekTo(position.longValue());
            player.play();
        });
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (controller == null) { call.reject("Trình phát nền chưa sẵn sàng."); return; }
        ContextCompat.getMainExecutor(getContext()).execute(() -> controller.play());
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (controller == null) { call.reject("Trình phát nền chưa sẵn sàng."); return; }
        ContextCompat.getMainExecutor(getContext()).execute(() -> controller.pause());
        call.resolve();
    }

    @PluginMethod
    public void seek(PluginCall call) {
        if (controller == null) { call.reject("Trình phát nền chưa sẵn sàng."); return; }
        Double position = call.getDouble("positionMs", 0d);
        long target = position == null ? 0L : position.longValue();
        ContextCompat.getMainExecutor(getContext()).execute(() -> controller.seekTo(target));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (controller != null) {
            ContextCompat.getMainExecutor(getContext()).execute(() -> {
                controller.stop();
                controller.clearMediaItems();
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        if (controller == null) {
            result.put("ready", false);
            result.put("playing", false);
            result.put("positionMs", 0);
            call.resolve(result);
            return;
        }
        result.put("ready", true);
        result.put("playing", controller.isPlaying());
        result.put("positionMs", controller.getCurrentPosition());
        result.put("durationMs", controller.getDuration());
        call.resolve(result);
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        if (controller != null && controller.getPlaybackState() == Player.STATE_ENDED) return;
        JSObject data = new JSObject();
        data.put("playing", isPlaying);
        notifyListeners("stateChange", data);
    }

    @Override
    public void onPlaybackStateChanged(int state) {
        if (state == Player.STATE_ENDED) {
            notifyListeners("ended", new JSObject());
        }
    }

    @Override
    public void onPlayerError(androidx.media3.common.PlaybackException error) {
        JSObject data = new JSObject();
        data.put("message", error.getMessage() == null ? "Không phát được audio." : error.getMessage());
        data.put("code", error.errorCode);
        notifyListeners("error", data);
    }
}
