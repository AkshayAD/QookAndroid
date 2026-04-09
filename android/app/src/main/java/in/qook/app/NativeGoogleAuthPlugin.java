package in.qook.app;

import android.app.Activity;
import android.os.CancellationSignal;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialInterruptedException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.UUID;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    private CredentialManager credentialManager;

    private CredentialManager getCredentialManager() {
        if (credentialManager == null) {
            credentialManager = CredentialManager.create(getContext());
        }
        return credentialManager;
    }

    private Executor getExecutor() {
        return ContextCompat.getMainExecutor(getContext());
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = call.getString("serverClientId");
        if (serverClientId == null || serverClientId.trim().isEmpty()) {
            call.reject(
                "Google sign-in is not configured for Android. Add the Android OAuth client for in.qook.app and download the refreshed google-services.json.",
                "MISCONFIGURED"
            );
            return;
        }

        if (!BuildConfig.HAS_ANDROID_GOOGLE_OAUTH) {
            call.reject(
                "Google sign-in is not configured for this Android build yet. Add the Android OAuth client for in.qook.app with the required SHA fingerprints, then refresh google-services.json.",
                "MISCONFIGURED"
            );
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Qook could not access the Android activity.", "UNAVAILABLE");
            return;
        }

        int playServicesStatus = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity);
        if (playServicesStatus != ConnectionResult.SUCCESS) {
            call.reject("Google Play services are unavailable on this device.", "PLAY_SERVICES_UNAVAILABLE");
            return;
        }

        GetSignInWithGoogleOption googleOption = new GetSignInWithGoogleOption.Builder(serverClientId)
            .setNonce(UUID.randomUUID().toString())
            .build();

        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build();

        getCredentialManager().getCredentialAsync(
            activity,
            request,
            new CancellationSignal(),
            getExecutor(),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    resolveGoogleCredential(call, result);
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    rejectSignIn(call, error);
                }
            }
        );
    }

    private void resolveGoogleCredential(PluginCall call, GetCredentialResponse response) {
        Credential credential = response.getCredential();
        if (!(credential instanceof CustomCredential)) {
            call.reject("Google sign-in returned an unexpected credential type.", "FAILED");
            return;
        }

        CustomCredential customCredential = (CustomCredential) credential;
        if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
            call.reject("Google sign-in returned an unexpected credential payload.", "FAILED");
            return;
        }

        try {
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(customCredential.getData());
            String idToken = googleCredential.getIdToken();
            if (idToken == null || idToken.trim().isEmpty()) {
                call.reject("Google sign-in did not return an ID token.", "INVALID_TOKEN");
                return;
            }

            JSObject payload = new JSObject();
            payload.put("idToken", idToken);
            payload.put("email", googleCredential.getId());
            payload.put("name", googleCredential.getDisplayName());
            payload.put(
                "photoUrl",
                googleCredential.getProfilePictureUri() != null
                    ? googleCredential.getProfilePictureUri().toString()
                    : null
            );
            call.resolve(payload);
        } catch (RuntimeException error) {
            call.reject("Google sign-in returned an invalid token response.", "INVALID_TOKEN", error);
        }
    }

    private void rejectSignIn(PluginCall call, GetCredentialException error) {
        String message = error.getMessage() != null ? error.getMessage() : "Google sign-in failed on Android.";

        if (error instanceof GetCredentialCancellationException) {
            call.reject("Google sign-in was cancelled.", "CANCELLED");
            return;
        }

        if (
            error instanceof GetCredentialProviderConfigurationException
            || isAndroidOAuthMisconfigured(message)
        ) {
            call.reject(
                "Google sign-in is not configured correctly for this Android build. Register in.qook.app with the correct SHA fingerprints and refresh google-services.json.",
                "MISCONFIGURED",
                error
            );
            return;
        }

        if (error instanceof NoCredentialException || error instanceof GetCredentialInterruptedException) {
            call.reject("Google sign-in is unavailable on this Android device right now.", "UNAVAILABLE", error);
            return;
        }

        call.reject(message, "FAILED", error);
    }

    private boolean isAndroidOAuthMisconfigured(String message) {
        String normalized = message.toLowerCase();
        return normalized.contains("developer error")
            || normalized.contains("not registered to use oauth")
            || normalized.contains("package name and sha-1")
            || normalized.contains("configuration error");
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Qook could not access the Android activity.", "UNAVAILABLE");
            return;
        }

        getCredentialManager().clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            getExecutor(),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void ignored) {
                    call.resolve();
                }

                @Override
                public void onError(@NonNull ClearCredentialException error) {
                    call.reject("Failed to clear the native Google credential state.", "FAILED", error);
                }
            }
        );
    }
}
