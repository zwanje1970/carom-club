package com.caromclub.webview

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.SystemClock
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
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
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

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

    /** 스플래시 유지: 첫 페이지 로드 + 최소 2초 */
    private val splashPageReady = AtomicBoolean(false)
    private var splashMinEndElapsedRealtime: Long = 0L

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
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        splashPageReady.set(false)
        splashMinEndElapsedRealtime = SystemClock.elapsedRealtime() + 2000L
        splashScreen.setKeepOnScreenCondition {
            val minElapsedOk = SystemClock.elapsedRealtime() >= splashMinEndElapsedRealtime
            !(splashPageReady.get() && minElapsedOk)
        }
        webView = WebView(this)
        setContentView(webView)

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

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    splashPageReady.set(true)
                    FcmRegister.postTokenToServer(this@MainActivity, BuildConfig.SITE_BASE_URL)
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
        if (raw.isNullOrBlank()) return defaultUrl
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
        if (this::webView.isInitialized) {
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }
}
