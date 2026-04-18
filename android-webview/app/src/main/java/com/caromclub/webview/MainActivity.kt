package com.caromclub.webview

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    companion object {
        /** FCM data 및 PendingIntent와 동일 키 */
        const val EXTRA_TARGET_URL = "url"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient =
            object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    FcmRegister.postTokenToServer(this@MainActivity, BuildConfig.SITE_BASE_URL)
                }
            }
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

    private fun resolveOpenUrl(intent: Intent?): String {
        val base = BuildConfig.SITE_BASE_URL.trim().trimEnd('/')
        val defaultUrl = "$base/site"
        val raw =
            intent?.getStringExtra(EXTRA_TARGET_URL)?.takeIf { it.isNotBlank() }
                ?: intent?.extras?.getString(EXTRA_TARGET_URL)?.takeIf { it.isNotBlank() }
        if (raw.isNullOrBlank()) return defaultUrl
        val t = raw.trim()
        return when {
            t.startsWith("http://") || t.startsWith("https://") -> {
                if (t.startsWith(base)) t else defaultUrl
            }
            t.startsWith("/") -> base + t
            else -> defaultUrl
        }
    }

    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
