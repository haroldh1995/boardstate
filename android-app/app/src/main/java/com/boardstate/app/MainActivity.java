package com.boardstate.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ConsoleMessage;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private static final String APP_BUNDLE_URL = "https://appassets.androidplatform.net/assets/www/index.html#battlefield";
    private static final String STATE_WEBVIEW = "state_webview";

    private WebView webView;
    private LinearLayout errorOverlay;
    private LinearLayout loadingOverlay;
    private TextView loadingText;
    private Button retryButton;
    private Button offlineButton;
    private ProgressBar loadingSpinner;
    private ValueCallback<Uri[]> filePathCallback;

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (filePathCallback == null) {
                return;
            }
            Uri[] results = null;
            if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                Uri uri = result.getData().getData();
                if (uri != null) {
                    results = new Uri[]{uri};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        });

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        bindViews();
        configureButtons();
        configureBackNavigation();
        configureWebView();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState.getBundle(STATE_WEBVIEW));
            hideLoading();
            return;
        }

        loadPreferredSource();
    }

    private void bindViews() {
        webView = findViewById(R.id.webView);
        errorOverlay = findViewById(R.id.errorOverlay);
        loadingOverlay = findViewById(R.id.loadingOverlay);
        loadingText = findViewById(R.id.loadingText);
        retryButton = findViewById(R.id.retryButton);
        offlineButton = findViewById(R.id.offlineButton);
        loadingSpinner = findViewById(R.id.loadingSpinner);
    }

    private void configureButtons() {
        retryButton.setOnClickListener(v -> {
            loadPreferredSource();
        });
        offlineButton.setOnClickListener(v -> {
            hideError();
            showLoading("Opening bundled offline copy...");
            webView.loadUrl(APP_BUNDLE_URL);
        });
    }

    private void configureBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(settings, true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView.setWebViewClient(new WebViewClient() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                showLoading("Loading BoardState...");
                hideError();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                hideLoading();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternalUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(Uri.parse(url));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    handleLoadFailure(error != null ? String.valueOf(error.getDescription()) : "Failed to load page.");
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
                if (request.isForMainFrame()) {
                    handleLoadFailure("HTTP " + errorResponse.getStatusCode() + " while loading BoardState.");
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                if (BuildConfig.DEBUG) {
                    android.util.Log.d("BoardStateWeb", message.message() + " @ " + message.sourceId() + ":" + message.lineNumber());
                }
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    fileChooserLauncher.launch(intent);
                } catch (ActivityNotFoundException ex) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                return false;
            }
        });

        webView.setDownloadListener((DownloadListener) (url, userAgent, contentDisposition, mimetype, contentLength) -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        });
    }

    private void loadPreferredSource() {
        hideError();
        showLoading("Loading BoardState...");
        webView.loadUrl(APP_BUNDLE_URL);
    }

    private boolean handleExternalUrl(@NonNull Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.US);
        if (!"http".equals(scheme) && !"https".equals(scheme) && !"file".equals(scheme)) {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
            return true;
        }

        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        boolean trustedHost = host.equals("appassets.androidplatform.net") || host.endsWith("api.scryfall.com");
        if (trustedHost) {
            return false;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        return true;
    }

    private void handleLoadFailure(String message) {
        hideLoading();
        showError(message);
    }

    private void showError(String message) {
        errorOverlay.setVisibility(View.VISIBLE);
        TextView errorMessage = findViewById(R.id.errorMessage);
        errorMessage.setText(message);
    }

    private void hideError() {
        errorOverlay.setVisibility(View.GONE);
    }

    private void showLoading(String status) {
        loadingOverlay.setVisibility(View.VISIBLE);
        loadingSpinner.setVisibility(View.VISIBLE);
        loadingText.setText(status);
    }

    private void hideLoading() {
        loadingOverlay.setVisibility(View.GONE);
    }

    @Override
    public void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        Bundle webBundle = new Bundle();
        webView.saveState(webBundle);
        outState.putBundle(STATE_WEBVIEW, webBundle);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
