package in.qook.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configure status bar AFTER Capacitor initializes to ensure our settings stick
        configureStatusBar();
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Re-apply on resume in case anything resets the flags
        configureStatusBar();
    }
    
    /**
     * Configure the status bar to show dark icons on a white background.
     * This ensures visibility regardless of Capacitor plugin or theme settings.
     */
    private void configureStatusBar() {
        Window window = getWindow();
        if (window == null) return;
        
        // Set status bar color to white
        window.setStatusBarColor(Color.WHITE);
        
        // Clear any translucent flags that might interfere
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        
        // Add flag for drawing behind status bar but with proper insets
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        
        // Ensure content does NOT extend behind status bar (app content starts below the bar)
        WindowCompat.setDecorFitsSystemWindows(window, true);
        
        // Set light status bar (dark icons) - this is the key!
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat insetsController = 
            WindowCompat.getInsetsController(window, decorView);
        
        if (insetsController != null) {
            // true = light status bar = DARK icons (confusing but correct)
            insetsController.setAppearanceLightStatusBars(true);
        }
    }
}
