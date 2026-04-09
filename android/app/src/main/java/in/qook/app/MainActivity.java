package in.qook.app;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);

        View rootView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
            publishWindowInsets(windowInsets);
            return windowInsets;
        });
        rootView.post(this::publishCurrentWindowInsets);
    }

    @Override
    public void onResume() {
        super.onResume();
        publishCurrentWindowInsets();
    }

    private void publishCurrentWindowInsets() {
        View rootView = getWindow().getDecorView();
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(rootView);
        if (insets != null) {
            publishWindowInsets(insets);
        }
    }

    private void publishWindowInsets(WindowInsetsCompat windowInsets) {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        Insets systemBarInsets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
        int topInset = Math.max(systemBarInsets.top, 0);
        int bottomInset = Math.max(systemBarInsets.bottom, 0);
        String script = String.format(
            Locale.US,
            "(function(){var root=document.documentElement;if(!root){return;}root.style.setProperty('--native-safe-area-top','%dpx');root.style.setProperty('--native-safe-area-bottom','%dpx');window.dispatchEvent(new CustomEvent('qook-native-insets',{detail:{top:%d,bottom:%d}}));})();",
            topInset,
            bottomInset,
            topInset,
            bottomInset
        );

        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(script, null));
    }
}
