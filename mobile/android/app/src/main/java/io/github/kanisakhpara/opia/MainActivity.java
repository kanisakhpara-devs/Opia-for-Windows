package io.github.kanisakhpara.opia;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Opia for Android: one WebView showing the phone app that is packed in assets/www.
 * The app is served from https://appassets.androidplatform.net so it runs as a secure page (storage, microphone and
 * module scripts all need that), but every request is answered from inside the APK; nothing goes to the network.
 * This class adds what a web page cannot do by itself: pick files, save to the gallery, share, and use the back button.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final int PICK_FILES = 1, MIC = 2;

    private WebView web;
    private FrameLayout root;
    private ValueCallback<Uri[]> pending;
    private PermissionRequest micRequest;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        clearOutbox();
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(14, 14, 16));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        fitSystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serve(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* no browser */ }
                return true;   // links to the website open in the phone's browser, not inside Opia
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pending != null) pending.onReceiveValue(null);
                pending = callback;
                return pickFiles(params);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> askForMic(request));
            }
        });
        web.addJavascriptInterface(new Bridge(), "OpiaAndroid");
        if (state != null) web.restoreState(state); else web.loadUrl(START);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    /* the back button closes the top sheet or screen in the app first */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.Player && Player.playing && Player.stop()", null);   // stop the music when you leave
    }

    /* keep the page clear of the status bar, the gesture bar and the keyboard */
    private void fitSystemBars() {
        Window w = getWindow();
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 30) w.setDecorFitsSystemWindows(false);
        else root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                l = i.left; t = i.top; r = i.right; b = i.bottom;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop(); r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });
    }

    /* light or dark status bar icons, to match the app's theme */
    @SuppressWarnings("deprecation")
    void setBars(int color, boolean light) {
        root.setBackgroundColor(color);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c == null) return;
            int both = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            c.setSystemBarsAppearance(light ? both : 0, both);
        } else {
            int f = root.getSystemUiVisibility();
            f = light ? f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : f & ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            root.setSystemUiVisibility(f);
        }
    }

    /* ---- the app's own files, straight from the APK */
    private static final Map<String, String> TYPES = new HashMap<>();
    static {
        String[][] t = { { "html", "text/html" }, { "js", "text/javascript" }, { "mjs", "text/javascript" }, { "css", "text/css" }, { "json", "application/json" },
            { "svg", "image/svg+xml" }, { "png", "image/png" }, { "jpg", "image/jpeg" }, { "webp", "image/webp" }, { "ico", "image/x-icon" },
            { "ttf", "font/ttf" }, { "otf", "font/otf" }, { "woff2", "font/woff2" }, { "mp3", "audio/mpeg" }, { "wav", "audio/wav" }, { "ogg", "audio/ogg" },
            { "pfb", "application/octet-stream" }, { "bcmap", "application/octet-stream" }, { "wasm", "application/wasm" }, { "txt", "text/plain" }, { "md", "text/plain" } };
        for (String[] p : t) TYPES.put(p[0], p[1]);
    }

    private WebResourceResponse serve(Uri u) {
        if (!HOST.equals(u.getHost())) return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", null, null);   // never the network
        String path = u.getPath();
        if (path == null || !path.startsWith("/assets/") || path.contains("..")) return notFound();
        String name = path.substring("/assets/".length()), ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        try {
            InputStream in = getAssets().open(name, AssetManager.ACCESS_STREAMING);
            String type = TYPES.containsKey(ext) ? TYPES.get(ext) : "application/octet-stream";
            boolean text = type.startsWith("text/") || type.endsWith("json") || type.endsWith("svg+xml");
            Map<String, String> head = new HashMap<>();
            head.put("Cache-Control", "no-cache");
            head.put("Access-Control-Allow-Origin", "https://" + HOST);
            return new WebResourceResponse(type, text ? "utf-8" : null, 200, "OK", head, in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() { return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null); }

    /* ---- picking photos, PDFs and sounds */
    private boolean pickFiles(WebChromeClient.FileChooserParams params) {
        String[] accept = params.getAcceptTypes();
        boolean many = params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
        List<String> types = new ArrayList<>();
        for (String a : accept) for (String part : a.split(",")) { part = part.trim(); if (part.contains("/")) types.add(part); }
        boolean images = !types.isEmpty();
        for (String type : types) if (!type.startsWith("image/")) images = false;
        Intent i;
        if (images && Build.VERSION.SDK_INT >= 33) {
            i = new Intent(MediaStore.ACTION_PICK_IMAGES);   // the phone's own photo picker
            i.setType("image/*");
            if (many) i.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, MediaStore.getPickImagesMaxLimit());
        } else {
            i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(types.size() == 1 ? types.get(0) : "*/*");
            if (types.size() > 1) i.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
            i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, many);
        }
        try {
            startActivityForResult(i, PICK_FILES);
            return true;
        } catch (ActivityNotFoundException e) {
            pending.onReceiveValue(null);
            pending = null;
            return false;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_FILES || pending == null) return;
        Uri[] got = null;
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                got = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < got.length; i++) got[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) got = new Uri[] { data.getData() };
        }
        pending.onReceiveValue(got);
        pending = null;
    }

    /* ---- the microphone, only when Groove asks for it */
    private void askForMic(PermissionRequest request) {
        boolean audio = false;
        for (String r : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) audio = true;
        if (!audio || !HOST.equals(request.getOrigin().getHost())) { request.deny(); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            return;
        }
        micRequest = request;
        requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, MIC);
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] perms, int[] results) {
        super.onRequestPermissionsResult(request, perms, results);
        if (request != MIC || micRequest == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) micRequest.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
        else micRequest.deny();
        micRequest = null;
    }

    /* ---- files on their way out: written to cache/out in pieces, then saved to the gallery or shared */
    private final Map<String, String[]> outgoing = new HashMap<>();   // id -> { file name, mime type }

    File outbox() { File d = new File(getCacheDir(), "out"); d.mkdirs(); return d; }

    private void clearOutbox() { File[] old = outbox().listFiles(); if (old != null) for (File f : old) f.delete(); }

    private Uri collection(String kind) {
        if ("pictures".equals(kind)) return MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        if ("music".equals(kind)) return MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        return MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
    }

    private String folder(String kind) {
        if ("pictures".equals(kind)) return "Pictures/Opia";
        if ("music".equals(kind)) return "Music/Opia";
        return "Download/Opia";
    }

    class Bridge {
        @JavascriptInterface
        public String begin(String name, String mime) {
            String id = UUID.randomUUID().toString();
            outgoing.put(id, new String[] { name, mime });
            new File(outbox(), id).delete();
            return id;
        }

        @JavascriptInterface
        public boolean append(String id, String base64) {
            if (!outgoing.containsKey(id)) return false;
            try (OutputStream o = new FileOutputStream(new File(outbox(), id), true)) {
                o.write(Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (IOException | IllegalArgumentException e) {
                return false;
            }
        }

        /* into Pictures/Opia, Music/Opia or Download/Opia, where the gallery and file apps see it */
        @JavascriptInterface
        public boolean save(String id, String kind) {
            String[] meta = outgoing.remove(id);
            File f = new File(outbox(), id);
            if (meta == null || !f.exists()) return false;
            ContentResolver cr = getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, meta[0]);
            v.put(MediaStore.MediaColumns.MIME_TYPE, meta[1]);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, folder(kind));
            v.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = null;
            try {
                uri = cr.insert(collection(kind), v);
                if (uri == null) return false;
                try (InputStream in = new FileInputStream(f); OutputStream out = cr.openOutputStream(uri)) {
                    if (out == null) throw new IOException("no output");
                    byte[] buf = new byte[1 << 16];
                    for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                }
                v.clear();
                v.put(MediaStore.MediaColumns.IS_PENDING, 0);
                cr.update(uri, v, null, null);
                return true;
            } catch (Exception e) {
                if (uri != null) cr.delete(uri, null, null);
                return false;
            } finally {
                f.delete();
            }
        }

        @JavascriptInterface
        public void share(String id) {
            String[] meta = outgoing.remove(id);
            if (meta == null) return;
            File named = new File(outbox(), meta[0].replaceAll("[\\\\/:*?\"<>|]", "_"));
            named.delete();
            if (!new File(outbox(), id).renameTo(named)) return;
            Uri uri = ShareProvider.uriFor(MainActivity.this, named);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(meta[1]);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            runOnUiThread(() -> startActivity(Intent.createChooser(send, null)));
        }

        @JavascriptInterface
        public void setBars(String hex, boolean light) {
            try {
                int c = Color.parseColor(hex);
                runOnUiThread(() -> MainActivity.this.setBars(c, light));
            } catch (IllegalArgumentException e) { /* not a colour */ }
        }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (PackageManager.NameNotFoundException e) { return ""; }
        }
    }
}
