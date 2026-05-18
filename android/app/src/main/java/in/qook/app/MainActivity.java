package in.qook.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.appcompat.app.ActionBar;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme_NoActionBar);
        EdgeToEdge.enable(
            this,
            SystemBarStyle.light(Color.TRANSPARENT, 0x66000000),
            SystemBarStyle.light(Color.TRANSPARENT, 0x66000000)
        );
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);

        ActionBar actionBar = getSupportActionBar();
        if (actionBar != null) {
            actionBar.hide();
        }

        Window window = getWindow();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        View rootView = window.getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
            publishWindowInsets(windowInsets);
            return windowInsets;
        });

        rootView.post(() -> {
            ViewCompat.requestApplyInsets(rootView);
            publishCurrentWindowInsets();
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        publishCurrentWindowInsets();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        View rootView = getWindow().getDecorView();
        rootView.post(() -> {
            ViewCompat.requestApplyInsets(rootView);
            publishCurrentWindowInsets();
        });
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
        Insets cutoutInsets = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());
        int topInset = Math.max(systemBarInsets.top, cutoutInsets.top);
        int bottomInset = Math.max(systemBarInsets.bottom, cutoutInsets.bottom);
        int leftInset = Math.max(systemBarInsets.left, cutoutInsets.left);
        int rightInset = Math.max(systemBarInsets.right, cutoutInsets.right);

        String script = String.format(
            Locale.US,
            "(function(){" +
            "  var root = document.documentElement;" +
            "  if(!root) return;" +
            "  var ratio = window.devicePixelRatio || 1;" +
            "  var top = Math.max(0, Math.ceil(%d / ratio));" +
            "  var bottom = Math.max(0, Math.ceil(%d / ratio));" +
            "  var left = Math.max(0, Math.ceil(%d / ratio));" +
            "  var right = Math.max(0, Math.ceil(%d / ratio));" +
            "  var topPx = top + 'px';" +
            "  var bottomPx = bottom + 'px';" +
            "  var leftPx = left + 'px';" +
            "  var rightPx = right + 'px';" +
            "  root.style.setProperty('--native-safe-area-top', topPx);" +
            "  root.style.setProperty('--native-safe-area-bottom', bottomPx);" +
            "  root.style.setProperty('--native-safe-area-left', leftPx);" +
            "  root.style.setProperty('--native-safe-area-right', rightPx);" +
            "  root.style.setProperty('--app-safe-top', topPx);" +
            "  root.style.setProperty('--app-safe-bottom', bottomPx);" +
            "  root.style.setProperty('--app-safe-left', leftPx);" +
            "  root.style.setProperty('--app-safe-right', rightPx);" +
            "  window.dispatchEvent(new CustomEvent('qook-native-insets',{detail:{top:top,bottom:bottom,left:left,right:right}}));" +
            "})();",
            topInset, bottomInset, leftInset, rightInset
        );

        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(script, null));
    }
}
