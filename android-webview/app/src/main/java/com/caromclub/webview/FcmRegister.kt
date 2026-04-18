package com.caromclub.webview

import android.content.Context
import android.webkit.CookieManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.Executors

object FcmRegister {
    private val executor = Executors.newSingleThreadExecutor()

    @Volatile
    var lastToken: String? = null

    fun postTokenToServer(context: Context, siteBaseUrl: String) {
        val token = lastToken ?: return
        val base = siteBaseUrl.trim().trimEnd('/')
        executor.execute {
            try {
                val cookie = CookieManager.getInstance().getCookie(base) ?: ""
                val body =
                    JSONObject()
                        .put("token", token)
                        .put("platform", "android")
                        .toString()
                val client = OkHttpClient()
                val req =
                    Request.Builder()
                        .url("$base/api/site/fcm/register")
                        .post(body.toRequestBody("application/json; charset=utf-8".toMediaType()))
                        .header("Cookie", cookie)
                        .build()
                client.newCall(req).execute().close()
            } catch (_: Exception) {
            }
        }
    }
}
