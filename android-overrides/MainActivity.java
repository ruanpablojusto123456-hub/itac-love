package br.com.itaclove.app;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Android 14+: detecta tentativa de print e avisa o app (JS: window 'itacScreenshot')
    private Object screenCaptureCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Bloqueia captura e gravação de tela em todo o app (o print sai preto)
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }

    @Override
    public void onStart() {
        super.onStart();
        if (Build.VERSION.SDK_INT >= 34) {
            Activity.ScreenCaptureCallback cb = () -> runOnUiThread(() -> {
                if (getBridge() != null) getBridge().triggerWindowJSEvent("itacScreenshot");
            });
            screenCaptureCallback = cb;
            registerScreenCaptureCallback(getMainExecutor(), cb);
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (Build.VERSION.SDK_INT >= 34 && screenCaptureCallback != null) {
            unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) screenCaptureCallback);
            screenCaptureCallback = null;
        }
    }
}
