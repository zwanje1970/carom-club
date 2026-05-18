package com.caromclub.webview

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.view.ViewGroup
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.MediaStore
import android.util.Log
import android.util.Base64
import android.widget.Toast
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.content.FileProvider
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.google.firebase.messaging.FirebaseMessaging
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt
import org.json.JSONObject

private const val ORIENTATION_BRIDGE_TAG = "CaromAppBridge"

/**
 * WebView 내 「떨림 로그 복사」 DOM/URL 확인용 — Logcat 태그 [CaromShakeDiagProbe].
 * 원인 확인 후 **반드시 false로 두거나 코드 제거**할 것(임시 진단).
 * `/site` 지연 프로브(`shakeSiteProbeHandler`·`evalShakeSiteDelayedDomProbe` 등) 포함 **전부 삭제 대상**.
 */
private const val SHAKE_DIAG_WEB_PROBE_ENABLED = true

private const val SHAKE_DIAG_PROBE_TAG = "CaromShakeDiagProbe"

/** `https://carom.club/site`(쿼리·해시·끝 슬래시 허용)일 때만 지연 프로브 시리즈 실행 */
private fun isHttpsCaromClubSitePublicUrl(url: String?): Boolean {
    if (url.isNullOrBlank()) return false
    return try {
        val uri = Uri.parse(url.trim())
        val scheme = uri.scheme?.lowercase(Locale.getDefault()) ?: return false
        if (scheme != "https") return false
        val host = uri.host?.lowercase(Locale.getDefault()) ?: return false
        if (host != "carom.club") return false
        val rawPath = uri.path ?: return false
        val path = if (rawPath.length > 1 && rawPath.endsWith("/")) rawPath.dropLast(1) else rawPath
        path == "/site"
    } catch (_: Exception) {
        false
    }
}

/**
 * 로컬 단말 검증 전용: `true`이면 앱 시작 직후 landscape 고정(전체 앱이 가로가 됨).
 * OS/Manifest가 회전을 허용하는지 확인한 뒤 **반드시 false로 되돌릴 것**. 배포 금지.
 */
private const val DIAGNOSTIC_FORCE_LANDSCAPE_ON_LAUNCH = false

private fun configurationOrientationLabel(orientation: Int): String =
    when (orientation) {
        Configuration.ORIENTATION_LANDSCAPE -> "LANDSCAPE"
        Configuration.ORIENTATION_PORTRAIT -> "PORTRAIT"
        Configuration.ORIENTATION_UNDEFINED -> "UNDEFINED"
        else -> "OTHER($orientation)"
    }

@Suppress("DEPRECATION")
private fun displayRotationForProbe(activity: AppCompatActivity): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        activity.display?.rotation ?: -1
    } else {
        activity.windowManager.defaultDisplay.rotation
    }

/** 회전 디버그: requestedOrientation / configuration / Display.rotation 한 줄로 */
private fun logOrientationProbe(tag: String, activity: AppCompatActivity) {
    val confRaw = activity.resources.configuration.orientation
    val req = activity.requestedOrientation
    val rot = displayRotationForProbe(activity)
    Log.d(
        ORIENTATION_BRIDGE_TAG,
        "probe[$tag] activity=${activity.javaClass.name} hash=${System.identityHashCode(activity)} " +
            "taskId=${activity.taskId} isFinishing=${activity.isFinishing} " +
            "requestedOrientation=$req " +
            "configuration.orientation=${configurationOrientationLabel(confRaw)} raw=$confRaw " +
            "displayRotation=$rot (0=up 1=90° 2=180 3=270)",
    )
}

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null
    /** 카메라 권한 요청 직후 이미지 피커에서 다중 선택 허용 여부 */
    private var pendingImagePickerAllowMultiple: Boolean = true
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null

    /** 메인(홈)에서만: 2초 이내 두 번 뒤로가기 시 종료 */
    private var lastBackPressedTime = 0L
    private lateinit var appBridge: CaromAppBridge

    /** 스플래시 유지: 첫 페이지 로드 + 최소 2초 */
    private val splashPageReady = AtomicBoolean(false)
    private var splashMinEndElapsedRealtime: Long = 0L

    /** [SHAKE_DIAG_WEB_PROBE_ENABLED] `doUpdateVisitedHistory` 스로틀 */
    private var lastShakeDiagWebProbeAtElapsed: Long = 0L

    /** [SHAKE_DIAG_WEB_PROBE_ENABLED] `/site` 지연 DOM 프로브 — 확인 후 제거 */
    private val shakeSiteProbeHandler = Handler(Looper.getMainLooper())
    private val shakeSiteProbeRunnables = mutableListOf<Runnable>()

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            val granted =
                grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                    grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            pendingGeoCallback?.invoke(pendingGeoOrigin, granted, false)
            pendingGeoCallback = null
            pendingGeoOrigin = null
        }

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                launchImagePickerWithOptionalCamera(includeCamera = true, pendingImagePickerAllowMultiple)
            } else {
                launchImagePickerWithOptionalCamera(includeCamera = false, pendingImagePickerAllowMultiple)
            }
        }

    private val storageWriteLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback ?: return@registerForActivityResult
            val uris = mutableListOf<Uri>()
            val dataIntent = result.data
            if (result.resultCode == RESULT_OK) {
                val clip = dataIntent?.clipData
                if (clip != null) {
                    for (i in 0 until clip.itemCount) {
                        clip.getItemAt(i)?.uri?.let { uris.add(it) }
                    }
                } else {
                    dataIntent?.data?.let { uris.add(it) }
                }
                if (uris.isEmpty()) {
                    cameraImageUri?.let { uris.add(it) }
                }
            }
            callback.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
            filePathCallback = null
            cameraImageUri = null
        }

    companion object {
        /** FCM data 및 PendingIntent와 동일 키 */
        const val EXTRA_TARGET_URL = "url"

        private const val EXIT_INTERVAL_MS = 2000L
        private const val EXIT_TOAST_MESSAGE = "한 번 더 누르면 앱이 종료됩니다"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        webView.setBackgroundColor(Color.BLACK)
        webView.layoutParams =
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        setContentView(webView)
        window.decorView.setBackgroundColor(Color.BLACK)

        Log.d(ORIENTATION_BRIDGE_TAG, "onCreate MainActivity — verifying launcher Activity instance")
        logOrientationProbe("onCreate.initial", this)
        if (DIAGNOSTIC_FORCE_LANDSCAPE_ON_LAUNCH) {
            Log.w(
                ORIENTATION_BRIDGE_TAG,
                "DIAGNOSTIC_FORCE_LANDSCAPE_ON_LAUNCH=true — forcing SCREEN_ORIENTATION_LANDSCAPE (remove after test)",
            )
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            logOrientationProbe("onCreate.afterDiagnosticForce", this)
            window.decorView.postDelayed({ logOrientationProbe("onCreate.diagnostic300ms", this) }, 300L)
            window.decorView.postDelayed({ logOrientationProbe("onCreate.diagnostic1000ms", this) }, 1000L)
        }

        setupWebView()
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                storageWriteLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }
        onBackPressedDispatcher.addCallback(this) {
            if (!this@MainActivity::webView.isInitialized) {
                finish()
                return@addCallback
            }
            if (webView.canGoBack()) {
                webView.goBack()
                return@addCallback
            }
            if (!isMainHomeWebUrl(webView.url)) {
                finish()
                return@addCallback
            }
            val now = System.currentTimeMillis()
            if (now - lastBackPressedTime < EXIT_INTERVAL_MS) {
                finish()
            } else {
                Toast.makeText(this@MainActivity, EXIT_TOAST_MESSAGE, Toast.LENGTH_SHORT).show()
                lastBackPressedTime = now
            }
        }

        Log.i("CaromWebView", "loadUrl next — CaromPdfDownload must already be registered on webView")
        webView.loadUrl(resolveOpenUrl(intent))

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) return@addOnCompleteListener
            val token = task.result ?: return@addOnCompleteListener
            FcmRegister.lastToken = token
            FcmRegister.postTokenToServer(this, BuildConfig.SITE_BASE_URL)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
            if (this::webView.isInitialized) {
                webView.loadUrl(resolveOpenUrl(intent))
            }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        Log.d(
            ORIENTATION_BRIDGE_TAG,
            "MainActivity.onConfigurationChanged orientation=${configurationOrientationLabel(newConfig.orientation)} " +
                "screenWidthDp=${newConfig.screenWidthDp} screenHeightDp=${newConfig.screenHeightDp} " +
                "requestedOrientation=$requestedOrientation",
        )
    }

    private fun evalShakeDiagWebProbe(
        view: WebView,
        reason: String,
        argUrl: String?,
        throttleMinMs: Long,
    ) {
        if (!SHAKE_DIAG_WEB_PROBE_ENABLED) return
        val now = SystemClock.elapsedRealtime()
        if (throttleMinMs > 0 && now - lastShakeDiagWebProbeAtElapsed < throttleMinMs) return
        lastShakeDiagWebProbeAtElapsed = now
        val js =
            """
            (function(){
              try {
                var el = document.querySelector('[aria-label="떨림 로그 복사"]');
                var r = el ? el.getBoundingClientRect() : null;
                return JSON.stringify({
                  href: location.href,
                  readyState: document.readyState,
                  includesText: !!(document.body && document.body.innerHTML.indexOf('떨림 로그 복사') >= 0),
                  hasButton: !!el,
                  rect: r ? { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom, right: r.right } : null
                });
              } catch (e) {
                return JSON.stringify({ error: String(e && e.message ? e.message : e) });
              }
            })();
            """.trimIndent()
        view.evaluateJavascript(js) { value: String? ->
            Log.i(
                SHAKE_DIAG_PROBE_TAG,
                "$reason argUrl=$argUrl webView.url=${view.url} probeJson=$value",
            )
        }
    }

    private fun cancelShakeSiteDelayedProbes() {
        for (r in shakeSiteProbeRunnables) {
            shakeSiteProbeHandler.removeCallbacks(r)
        }
        shakeSiteProbeRunnables.clear()
    }

    private fun evalShakeSiteDelayedDomProbe(
        view: WebView,
        probeLabel: String,
    ) {
        if (!SHAKE_DIAG_WEB_PROBE_ENABLED) return
        val quotedLabel = JSONObject.quote(probeLabel)
        val js =
            """
            (function(){
              try {
                var probeLabel = $quotedLabel;
                var href = location.href;
                var u;
                try { u = new URL(href); } catch (e0) {
                  return JSON.stringify({
                    probeLabel: probeLabel,
                    href: href,
                    error: "invalid-location-href"
                  });
                }
                var host = (u.hostname || "").toLowerCase();
                var pathRaw = u.pathname || "";
                var path = (pathRaw.length > 1 && pathRaw.endsWith("/")) ? pathRaw.slice(0, -1) : pathRaw;
                if (u.protocol !== "https:" || host !== "carom.club" || path !== "/site") {
                  return JSON.stringify({
                    probeLabel: probeLabel,
                    skip: true,
                    href: href,
                    host: host,
                    path: path
                  });
                }
                var el = document.querySelector('[aria-label="떨림 로그 복사"]');
                var r = el ? el.getBoundingClientRect() : null;
                var body = document.body;
                var vp = document.querySelector('[data-site-main-scroll-viewport="1"]');
                var cards = document.querySelectorAll('[data-site-scroll-card]');
                return JSON.stringify({
                  probeLabel: probeLabel,
                  href: href,
                  readyState: document.readyState,
                  includesText: !!(body && body.innerHTML.indexOf('떨림 로그 복사') >= 0),
                  hasButton: !!el,
                  rect: r ? { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom, right: r.right } : null,
                  bodyInnerHTMLLength: body ? body.innerHTML.length : 0,
                  hasMainScrollViewport: !!vp,
                  scrollCardCount: cards ? cards.length : 0
                });
              } catch (e) {
                return JSON.stringify({
                  probeLabel: $quotedLabel,
                  error: String(e && e.message ? e.message : e)
                });
              }
            })();
            """.trimIndent()
        view.evaluateJavascript(js) { value: String? ->
            Log.i(SHAKE_DIAG_PROBE_TAG, "probeLabel=$probeLabel webView.url=${view.url} probeJson=$value")
        }
    }

    private fun scheduleShakeSiteProbeSeriesIfApplicable(
        view: WebView,
        triggerUrl: String?,
    ) {
        if (!SHAKE_DIAG_WEB_PROBE_ENABLED) return
        val u = triggerUrl ?: view.url
        if (!isHttpsCaromClubSitePublicUrl(u) && !isHttpsCaromClubSitePublicUrl(view.url)) return
        cancelShakeSiteDelayedProbes()
        val steps =
            listOf(
                "site-immediate" to 0L,
                "site-1000ms" to 1000L,
                "site-3000ms" to 3000L,
                "site-5000ms" to 5000L,
            )
        for ((label, delayMs) in steps) {
            val runnable =
                Runnable {
                    if (!SHAKE_DIAG_WEB_PROBE_ENABLED || isFinishing || !this@MainActivity::webView.isInitialized) {
                        return@Runnable
                    }
                    evalShakeSiteDelayedDomProbe(webView, label)
                }
            shakeSiteProbeRunnables.add(runnable)
            shakeSiteProbeHandler.postDelayed(runnable, delayMs)
        }
        Log.i(
            SHAKE_DIAG_PROBE_TAG,
            "shakeSiteProbeSeries scheduled triggerUrl=$triggerUrl view.url=${view.url} steps=${steps.size}",
        )
    }

    private fun setupWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setSupportMultipleWindows(false)
        settings.loadsImagesAutomatically = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setGeolocationEnabled(true)
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
        }

        appBridge = CaromAppBridge(this, webView)
        webView.addJavascriptInterface(appBridge, "CaromAppBridge")
        webView.addJavascriptInterface(PdfDownloadBridge(this, webView), "CaromPdfDownload")
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            if (url.isNullOrBlank()) return@setDownloadListener
            Log.d(
                "CaromWebView",
                "DownloadListener url=${url.take(120)} mime=$mimeType contentDisposition=$contentDisposition len=$contentLength",
            )
            if (url.startsWith("blob:")) {
                return@setDownloadListener
            }
            if (!url.startsWith("http://") && !url.startsWith("https://")) return@setDownloadListener
            try {
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val request = DownloadManager.Request(Uri.parse(url))
                request.setMimeType(mimeType ?: "application/octet-stream")
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
                val subPath = "${PdfDownloadStorage.FOLDER_NAME}/$name"
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, subPath)
                dm.enqueue(request)
            } catch (e: Exception) {
                Log.e("CaromWebView", "DownloadManager enqueue failed", e)
            }
        }

        webView.webViewClient =
            object : WebViewClient() {
                override fun onPageStarted(
                    view: WebView?,
                    url: String?,
                    favicon: Bitmap?,
                ) {
                    super.onPageStarted(view, url, favicon)
                    this@MainActivity.cancelShakeSiteDelayedProbes()
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val raw = request?.url?.toString() ?: return false
                    if (shouldOpenExternal(raw)) {
                        openExternal(raw)
                        return true
                    }
                    return false
                }

                /** 클라이언트 라우팅(`router.push`) 등으로 `onPageFinished`가 다시 안 올 때 URL/DOM 확인용 */
                override fun doUpdateVisitedHistory(
                    view: WebView?,
                    url: String?,
                    isReload: Boolean,
                ) {
                    super.doUpdateVisitedHistory(view, url, isReload)
                    if (view != null) {
                        this@MainActivity.evalShakeDiagWebProbe(
                            view,
                            "doUpdateVisitedHistory(isReload=$isReload)",
                            url,
                            throttleMinMs = 450L,
                        )
                        this@MainActivity.scheduleShakeSiteProbeSeriesIfApplicable(view, url)
                    }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    splashPageReady.set(true)
                    FcmRegister.postTokenToServer(this@MainActivity, BuildConfig.SITE_BASE_URL)
                    if (view != null) {
                        this@MainActivity.evalShakeDiagWebProbe(view, "onPageFinished", url, throttleMinMs = 0L)
                        this@MainActivity.scheduleShakeSiteProbeSeriesIfApplicable(view, url)
                    }
                }
            }

        webView.webChromeClient =
            object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    if (filePathCallback == null) return false
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback

                    val acceptTypes =
                        fileChooserParams?.acceptTypes
                            ?.map { it.trim() }
                            ?.filter { it.isNotEmpty() }
                            .orEmpty()
                    val allowMultiple = fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE

                    val imageOnlyChooser =
                        acceptTypes.isEmpty() ||
                            acceptTypes.all { t ->
                                val lower = t.lowercase(Locale.getDefault())
                                lower == "image/*" || lower.startsWith("image/")
                            }

                    if (!imageOnlyChooser) {
                        launchDocumentContentPicker(acceptTypes.toTypedArray(), allowMultiple)
                        return true
                    }

                    pendingImagePickerAllowMultiple = allowMultiple
                    val hasCameraPermission =
                        ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                    if (hasCameraPermission) {
                        launchImagePickerWithOptionalCamera(includeCamera = true, allowMultiple)
                    } else {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                    return true
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    if (origin == null || callback == null) return
                    val fineGranted =
                        ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED
                    val coarseGranted =
                        ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED
                    if (fineGranted || coarseGranted) {
                        callback.invoke(origin, true, false)
                        return
                    }
                    pendingGeoOrigin = origin
                    pendingGeoCallback = callback
                    locationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                        )
                    )
                }
            }

        Log.i(
            "CaromWebView",
            "setupWebView: javaScriptEnabled=${settings.javaScriptEnabled}, " +
                "JavascriptInterface CaromPdfDownload registered on this WebView before loadUrl",
        )
    }

    /**
     * 공개 사이트 홈(`/`, `/site`)·클라이언트 홈(`/client`)만 메인으로 본다.
     * 하위 경로(`/site/community` 등)는 메인이 아님.
     */
    private fun isMainHomeWebUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri =
            try {
                Uri.parse(url)
            } catch (_: Exception) {
                return false
            }
        if (uri.scheme != "http" && uri.scheme != "https") return false
        val rawPath = uri.path
        val path =
            when {
                rawPath.isNullOrEmpty() || rawPath == "/" -> "/"
                rawPath.length > 1 && rawPath.endsWith("/") -> rawPath.dropLast(1)
                else -> rawPath
            }
        return path == "/" || path == "/site" || path == "/client"
    }

    private fun resolveOpenUrl(intent: Intent?): String {
        val base = BuildConfig.SITE_BASE_URL.trim().trimEnd('/')
        val defaultUrl = if (base.isBlank()) "https://carom.club" else base
        val raw =
            intent?.getStringExtra(EXTRA_TARGET_URL)?.takeIf { it.isNotBlank() }
                ?: intent?.extras?.getString(EXTRA_TARGET_URL)?.takeIf { it.isNotBlank() }
        // 앱 내부 스플래시에서 세션·권한 등 최소 준비 후 메인(/)으로 이동
        if (raw.isNullOrBlank()) return "$defaultUrl/mobile-splash"
        val t = raw.trim()
        return when {
            t.startsWith("http://") || t.startsWith("https://") -> t
            t.startsWith("/") -> defaultUrl + t
            else -> defaultUrl
        }
    }

    private fun shouldOpenExternal(url: String): Boolean {
        val lower = url.lowercase(Locale.getDefault())
        return lower.startsWith("tel:") ||
            lower.startsWith("sms:") ||
            lower.startsWith("mailto:") ||
            lower.startsWith("intent:") ||
            lower.startsWith("kakaomap:") ||
            lower.endsWith(".pdf")
    }

    private fun openExternal(rawUrl: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(rawUrl))
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            // no-op
        }
    }

    /** HTML `accept`가 이미지일 때만: 갤러리·(선택) 카메라. PDF/DOCX 등은 호출하지 않는다. */
    private fun launchImagePickerWithOptionalCamera(
        includeCamera: Boolean,
        allowMultiple: Boolean,
    ) {
        val intents = mutableListOf<Intent>()
        if (includeCamera) {
            createImageCaptureIntent()?.let { intents.add(it) }
        }

        val pickIntent =
            Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
            }

        val chooser =
            Intent.createChooser(pickIntent, "이미지 선택").apply {
                if (intents.isNotEmpty()) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, intents.toTypedArray())
                }
            }

        fileChooserLauncher.launch(chooser)
    }

    /** PDF·문서 전용 input — 카메라 인텐트 없이 문서/내 파일 쪽으로 연다. */
    private fun launchDocumentContentPicker(
        mimeTypes: Array<String>,
        allowMultiple: Boolean,
    ) {
        val pickIntent =
            Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                if (mimeTypes.isNotEmpty()) {
                    putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
                }
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
            }
        fileChooserLauncher.launch(Intent.createChooser(pickIntent, "파일 선택"))
    }

    private fun createImageCaptureIntent(): Intent? {
        val photoFile = createImageTempFile() ?: return null
        val authority = "${BuildConfig.APPLICATION_ID}.fileprovider"
        cameraImageUri = FileProvider.getUriForFile(this, authority, photoFile)
        return Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
    }

    private fun createImageTempFile(): File? {
        return try {
            val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            File.createTempFile("carom_${stamp}_", ".jpg", cacheDir)
        } catch (_: IOException) {
            null
        }
    }

    override fun onDestroy() {
        cancelShakeSiteDelayedProbes()
        if (this::webView.isInitialized) {
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }
}

class CaromAppBridge(
    private val activity: AppCompatActivity,
    private val webView: WebView,
) {
    companion object {
        private const val CARD_CAPTURE_LOG_TAG = "card-publish-capture"

        private const val DIAG_BRIDGE_ECHO_TEST = false
    }
    @Volatile
    private var captureInProgress: Boolean = false

    private fun postCaptureResult(payload: JSONObject) {
        // JSONObject.quote()로 JSON 전체를 안전하게 이스케이프한 뒤 JS 문자열 인수로 전달.
        val escaped = try {
            JSONObject.quote(payload.toString())
        } catch (t: Throwable) {
            Log.e(CARD_CAPTURE_LOG_TAG, "postCaptureResult: JSON quote failed", t)
            return
        }
        val script = "window.CaromNativeCapture && window.CaromNativeCapture.onResult($escaped);"
        Handler(Looper.getMainLooper()).post {
            try {
                webView.evaluateJavascript(script, null)
                Log.i(CARD_CAPTURE_LOG_TAG, "evaluateJavascript dispatched ok")
            } catch (t: Throwable) {
                // evaluateJavascript 자체가 실패하면 Logcat에만 기록 가능
                Log.e(CARD_CAPTURE_LOG_TAG, "evaluateJavascript FAILED: [${t.javaClass.simpleName}] ${t.message}", t)
            }
        }
    }

    private fun postCaptureError(requestId: String, code: String, message: String) {
        val payload =
            JSONObject().apply {
                put("ok", false)
                put("requestId", requestId)
                put("code", code)
                put("message", message)
            }
        postCaptureResult(payload)
    }

    @JavascriptInterface
    fun captureCardRegion(requestJson: String) {
        Log.i(CARD_CAPTURE_LOG_TAG, "native captureCardRegion reached")
        val req =
            try {
                JSONObject(requestJson)
            } catch (_: Exception) {
                postCaptureError("", "E_INVALID_RECT", "요청 형식이 잘못되었습니다.")
                return
            }
        val requestId = req.optString("requestId", "").trim()
        Log.i(CARD_CAPTURE_LOG_TAG, "native request parsed requestId=$requestId")
        if (requestId.isBlank()) {
            postCaptureError("", "E_INVALID_RECT", "요청 ID가 없습니다.")
            return
        }

        // ── [진단 에코 테스트] ─────────────────────────────────────────────────
        // DIAG_BRIDGE_ECHO_TEST = true 동안 비트맵 처리 없이 즉시 응답을 반환한다.
        // JS 팝업이 뜨면 브리지 연결 OK. 안 뜨면 JavascriptInterface 등록 자체가 파손됨.
        // 확인 후 companion object의 DIAG_BRIDGE_ECHO_TEST 를 false 로 변경할 것.
        if (DIAG_BRIDGE_ECHO_TEST) {
            Log.w(CARD_CAPTURE_LOG_TAG, "DIAG_BRIDGE_ECHO_TEST active — 실제 캡처 없이 즉시 응답")
            postCaptureError(
                requestId,
                "E_DIAG_BRIDGE_OK",
                "브리지 진입 확인. 이 팝업이 보이면 JS↔Native 연결 정상. requestId=$requestId",
            )
            return
        }

        if (captureInProgress) {
            Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_CAPTURE_FAILED reason=in_flight requestId=$requestId")
            postCaptureError(requestId, "E_CAPTURE_FAILED", "이미 캡처가 진행 중입니다.")
            return
        }
        val left = req.optDouble("left", Double.NaN)
        val top = req.optDouble("top", Double.NaN)
        val width = req.optDouble("width", Double.NaN)
        val height = req.optDouble("height", Double.NaN)
        val viewportWidth = req.optDouble("viewportWidth", Double.NaN)
        val viewportHeight = req.optDouble("viewportHeight", Double.NaN)
        val targetWidth = req.optInt("targetWidth", 0)
        val format = req.optString("format", "png").trim().lowercase(Locale.getDefault())
        if (!left.isFinite() || !top.isFinite() || !width.isFinite() || !height.isFinite()) {
            Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_INVALID_RECT reason=non_finite_rect requestId=$requestId")
            postCaptureError(requestId, "E_INVALID_RECT", "캡처 좌표가 유효하지 않습니다.")
            return
        }
        if (!viewportWidth.isFinite() || !viewportHeight.isFinite() || viewportWidth <= 0.0 || viewportHeight <= 0.0) {
            Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_INVALID_RECT reason=invalid_viewport requestId=$requestId")
            postCaptureError(requestId, "E_INVALID_RECT", "뷰포트 크기가 유효하지 않습니다.")
            return
        }
        if (width <= 1.0 || height <= 1.0) {
            Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_INVALID_RECT reason=too_small_rect requestId=$requestId")
            postCaptureError(requestId, "E_INVALID_RECT", "캡처 영역 크기가 너무 작습니다.")
            return
        }
        if (format != "png") {
            Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_ENCODE_FAILED reason=unsupported_format requestId=$requestId")
            postCaptureError(requestId, "E_ENCODE_FAILED", "지원하지 않는 포맷입니다.")
            return
        }
        captureInProgress = true
        Handler(Looper.getMainLooper()).post {
            var sourceBitmap: Bitmap? = null
            var cropped: Bitmap? = null
            try {
                // ── 1. WebView 전체 비트맵 캡처 ──────────────────────────────────
                val vw = webView.width
                val vh = webView.height
                if (vw <= 0 || vh <= 0) {
                    Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_CAPTURE_FAILED reason=invalid_webview_size requestId=$requestId vw=$vw vh=$vh")
                    postCaptureError(requestId, "E_CAPTURE_FAILED", "WebView 크기를 확인할 수 없습니다.")
                    return@post
                }
                sourceBitmap = try {
                    val b = Bitmap.createBitmap(vw, vh, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(b)
                    webView.draw(canvas)
                    b
                } catch (oom: OutOfMemoryError) {
                    Log.e(CARD_CAPTURE_LOG_TAG, "native fail code=E_OOM reason=draw_oom requestId=$requestId", oom)
                    postCaptureError(requestId, "E_OOM", "[OutOfMemoryError] WebView 드로우 중 메모리 부족: ${oom.message}")
                    return@post
                } catch (e: Exception) {
                    Log.e(CARD_CAPTURE_LOG_TAG, "native fail code=E_CAPTURE_FAILED reason=draw_exception requestId=$requestId", e)
                    postCaptureError(requestId, "E_CAPTURE_FAILED", "[${e.javaClass.simpleName}] WebView 드로우 실패: ${e.message}")
                    return@post
                }

                // ── 2. 크롭 좌표 계산 (수학적 방어 포함) ────────────────────────
                val bw = sourceBitmap.width
                val bh = sourceBitmap.height
                val scaleX = bw.toDouble() / viewportWidth
                val scaleY = bh.toDouble() / viewportHeight

                // 원시 계산값 로깅 (좌표 이슈 디버깅용)
                val rawCropLeft = (left * scaleX).roundToInt()
                val rawCropTop = (top * scaleY).roundToInt()
                val rawCropWidth = (width * scaleX).roundToInt()
                val rawCropHeight = (height * scaleY).roundToInt()
                Log.i(
                    CARD_CAPTURE_LOG_TAG,
                    "native crop raw requestId=$requestId bitmap=${bw}x${bh} " +
                        "viewport=${viewportWidth}x${viewportHeight} " +
                        "js=[l=$left t=$top w=$width h=$height] " +
                        "raw=[l=$rawCropLeft t=$rawCropTop w=$rawCropWidth h=$rawCropHeight]",
                )

                if (rawCropWidth <= 0 || rawCropHeight <= 0) {
                    Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_CROP_OUT_OF_BOUNDS reason=empty_raw_crop requestId=$requestId")
                    postCaptureError(requestId, "E_CROP_OUT_OF_BOUNDS", "캡처 영역이 비어 있습니다.")
                    return@post
                }

                // 비트맵 범위를 절대로 벗어나지 않도록 수학적 방어
                // ※ coerceIn(1, 0) 은 IAE를 던지므로 상한을 먼저 1 이상으로 보장해야 한다.
                val safeLeft = rawCropLeft.coerceIn(0, (bw - 1).coerceAtLeast(0))
                val safeTop = rawCropTop.coerceIn(0, (bh - 1).coerceAtLeast(0))
                val safeWidth = rawCropWidth.coerceIn(1, (bw - safeLeft).coerceAtLeast(1))
                val safeHeight = rawCropHeight.coerceIn(1, (bh - safeTop).coerceAtLeast(1))
                Log.i(
                    CARD_CAPTURE_LOG_TAG,
                    "native crop safe requestId=$requestId [l=$safeLeft t=$safeTop w=$safeWidth h=$safeHeight]",
                )

                cropped = try {
                    Bitmap.createBitmap(sourceBitmap, safeLeft, safeTop, safeWidth, safeHeight)
                } catch (e: IllegalArgumentException) {
                    Log.e(CARD_CAPTURE_LOG_TAG, "native fail code=E_CROP_OUT_OF_BOUNDS reason=createBitmap_iae requestId=$requestId bitmap=${bw}x${bh} crop=[l=$safeLeft t=$safeTop w=$safeWidth h=$safeHeight]", e)
                    postCaptureError(requestId, "E_CROP_OUT_OF_BOUNDS", "[IllegalArgumentException] 크롭 범위 초과 bitmap=${bw}x${bh} safe=[l=$safeLeft t=$safeTop w=$safeWidth h=$safeHeight]: ${e.message}")
                    return@post
                } catch (oom: OutOfMemoryError) {
                    Log.e(CARD_CAPTURE_LOG_TAG, "native fail code=E_OOM reason=crop_oom requestId=$requestId", oom)
                    postCaptureError(requestId, "E_OOM", "[OutOfMemoryError] 크롭 중 메모리 부족: ${oom.message}")
                    return@post
                }

                // ── 3. targetWidth로 비율 유지 리사이즈 (ARGB_8888 고정) ─────────
                if (targetWidth > 0 && cropped.width != targetWidth) {
                    // Float 기반 비율 계산 — 분모(cropped.width) 0 방어 후 targetHeight 산출
                    val cropW = cropped.width.coerceAtLeast(1).toFloat()
                    val cropH = cropped.height.coerceAtLeast(1).toFloat()
                    val resizeHeight = Math.round(cropH / cropW * targetWidth.toFloat()).coerceAtLeast(1)
                    if (resizeHeight <= 0) {
                        Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_CAPTURE_FAILED reason=zero_resize_height requestId=$requestId cropW=$cropW cropH=$cropH targetWidth=$targetWidth")
                        postCaptureError(requestId, "E_CAPTURE_FAILED", "리사이즈 높이 계산 결과가 0입니다. cropW=$cropW cropH=$cropH")
                        return@post
                    }
                    Log.i(
                        CARD_CAPTURE_LOG_TAG,
                        "native resize start requestId=$requestId " +
                            "src=${cropped.width}x${cropped.height} -> ${targetWidth}x${resizeHeight}",
                    )
                    val resized = try {
                        // Canvas + ARGB_8888 강제 지정, paint 속성 명시
                        val dst = Bitmap.createBitmap(targetWidth, resizeHeight, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(dst)
                        val paint = Paint().apply {
                            isAntiAlias = true
                            isFilterBitmap = true
                        }
                        canvas.drawBitmap(
                            cropped,
                            null,
                            RectF(0f, 0f, targetWidth.toFloat(), resizeHeight.toFloat()),
                            paint,
                        )
                        dst
                    } catch (oom: OutOfMemoryError) {
                        Log.e(CARD_CAPTURE_LOG_TAG, "native fail code=E_OOM reason=resize_oom requestId=$requestId", oom)
                        postCaptureError(requestId, "E_OOM", "[OutOfMemoryError] 리사이즈 중 메모리 부족 (${targetWidth}px): ${oom.message}")
                        return@post
                    } catch (e: Exception) {
                        Log.e(CARD_CAPTURE_LOG_TAG, "native fail code=E_CAPTURE_FAILED reason=resize_exception requestId=$requestId", e)
                        postCaptureError(requestId, "E_CAPTURE_FAILED", "[${e.javaClass.simpleName}] 리사이즈 실패 (${targetWidth}px): ${e.message}")
                        return@post
                    }
                    cropped.recycle()
                    cropped = resized
                    Log.i(
                        CARD_CAPTURE_LOG_TAG,
                        "native resize ok requestId=$requestId result=${cropped.width}x${cropped.height}",
                    )
                }

                // ── 4. PNG 인코딩 ─────────────────────────────────────────────────
                val out = ByteArrayOutputStream()
                val compressed = cropped.compress(Bitmap.CompressFormat.PNG, 100, out)
                if (!compressed) {
                    Log.w(CARD_CAPTURE_LOG_TAG, "native fail code=E_ENCODE_FAILED reason=compress_false requestId=$requestId")
                    postCaptureError(requestId, "E_ENCODE_FAILED", "PNG 인코딩에 실패했습니다.")
                    return@post
                }
                val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)

                // ── 5. 결과 전송 ──────────────────────────────────────────────────
                val payload =
                    JSONObject().apply {
                        put("ok", true)
                        put("requestId", requestId)
                        put("format", "png")
                        put("mimeType", "image/png")
                        put("base64", base64)
                        put("bitmapWidth", sourceBitmap.width)
                        put("bitmapHeight", sourceBitmap.height)
                        put("cropWidth", cropped.width)
                        put("cropHeight", cropped.height)
                    }
                postCaptureResult(payload)
                Log.i(
                    CARD_CAPTURE_LOG_TAG,
                    "native result ok requestId=$requestId final=${cropped.width}x${cropped.height} base64Len=${base64.length}",
                )
            } catch (t: Throwable) {
                // Exception + OutOfMemoryError + 모든 시스템 Error를 싹 다 포착
                val crashLog = "[${t.javaClass.simpleName}] ${t.message ?: "(no message)"}"
                Log.e(CARD_CAPTURE_LOG_TAG, "native fail code=E_NATIVE_CRASH requestId=$requestId $crashLog", t)
                try {
                    postCaptureError(requestId, "E_NATIVE_CRASH", crashLog)
                } catch (inner: Throwable) {
                    // postCaptureError 자체도 실패할 경우 Logcat에만 기록
                    Log.e(CARD_CAPTURE_LOG_TAG, "postCaptureError also failed: ${inner.message}", inner)
                }
            } finally {
                // captureInProgress는 어떤 경로로 종료되더라도 반드시 해제
                try { cropped?.recycle() } catch (_: Throwable) { /* no-op */ }
                try { sourceBitmap?.recycle() } catch (_: Throwable) { /* no-op */ }
                captureInProgress = false
            }
        }
    }

    @JavascriptInterface
    fun exitApp() {
        activity.runOnUiThread {
            activity.finish()
        }
    }

    @JavascriptInterface
    fun requestOrientation(mode: String) {
        Log.d(
            ORIENTATION_BRIDGE_TAG,
            "JS->Native requestOrientation(mode=$mode) thread=${Thread.currentThread().name} " +
                "activity=${activity.javaClass.name} hash=${System.identityHashCode(activity)} " +
                "isFinishing=${activity.isFinishing}",
        )
        activity.runOnUiThread {
            logOrientationProbe("bridge.beforeSet", activity)
            /* 고정 방향: 시스템 자동 회전과 무관하게 요청 (sensor* 대신 고정값) */
            val target =
                if (mode.equals("landscape", ignoreCase = true)) {
                    ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                } else {
                    ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                }
            activity.requestedOrientation = target
            Log.d(ORIENTATION_BRIDGE_TAG, "bridge set requestedOrientation targetConstant=$target")
            val applied = activity.requestedOrientation
            val matchesLandscape =
                mode.equals("landscape", ignoreCase = true) &&
                    applied == ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            val matchesPortrait =
                !mode.equals("landscape", ignoreCase = true) &&
                    applied == ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            Log.d(
                ORIENTATION_BRIDGE_TAG,
                "verify requestedOrientation matches fixed constant: landscapeOk=$matchesLandscape portraitOk=$matchesPortrait applied=$applied",
            )
            logOrientationProbe("bridge.afterSetImmediate", activity)
            activity.window.decorView.post {
                logOrientationProbe("bridge.afterDecorViewPost", activity)
            }
            activity.window.decorView.postDelayed({
                logOrientationProbe("bridge.after300ms", activity)
            }, 300L)
            activity.window.decorView.postDelayed({
                logOrientationProbe("bridge.after1000ms", activity)
            }, 1000L)
        }
    }

    @JavascriptInterface
    fun requestLandscape() {
        requestOrientation("landscape")
    }

    @JavascriptInterface
    fun requestPortrait() {
        requestOrientation("portrait")
    }
}
