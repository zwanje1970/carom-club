package com.caromclub.webview

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.media.MediaScannerConnection
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

/** WebView blob PDF → 기기 Downloads/캐롬클럽/ 저장 (JavascriptInterface). */
@SuppressLint("JavascriptInterface")
class PdfDownloadBridge(
    private val activity: AppCompatActivity,
) {
    private val executor = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun savePdfBase64(base64Payload: String, fileName: String) {
        Log.i(
            TAG,
            "savePdfBase64 invoked fileName=$fileName base64Len=${base64Payload.length}",
        )
        activity.runOnUiThread {
            Toast.makeText(
                activity,
                "Android PDF 저장 시작\n$fileName\nbase64 ${base64Payload.length}자",
                Toast.LENGTH_LONG,
            ).show()
        }
        val name = PdfDownloadStorage.sanitizeFileName(fileName)
        if (name.isEmpty()) {
            activity.runOnUiThread {
                Toast.makeText(activity, "다운로드 실패", Toast.LENGTH_SHORT).show()
            }
            return
        }
        executor.execute {
            val ok =
                try {
                    val pure = PdfDownloadStorage.stripBase64Prefix(base64Payload.trim())
                    val bytes = Base64.decode(pure, Base64.DEFAULT)
                    if (bytes.isEmpty()) {
                        false
                    } else {
                        PdfDownloadStorage.savePdf(activity, bytes, name)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "savePdfBase64 decode/write", e)
                    false
                }
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    if (ok) "다운로드 완료" else "다운로드 실패",
                    Toast.LENGTH_SHORT,
                ).show()
            }
        }
    }

    companion object {
        private const val TAG = "CaromPdfDownload"
    }
}

object PdfDownloadStorage {
    /** 다운로드 폴더 하위 고정 디렉터리 (웹과 무관, 요구사항 고정명). */
    const val FOLDER_NAME = "캐롬클럽"

    fun sanitizeFileName(raw: String): String {
        var s = raw.trim().replace(Regex("[\\\\/]+"), "_").replace("..", "_")
        if (s.isBlank()) return ""
        if (!s.endsWith(".pdf", ignoreCase = true)) {
            s += ".pdf"
        }
        return s
    }

    fun stripBase64Prefix(s: String): String {
        val idx = s.indexOf(',')
        return if (s.startsWith("data:", ignoreCase = true) && idx >= 0) {
            s.substring(idx + 1)
        } else {
            s
        }
    }

    fun savePdf(activity: Activity, bytes: ByteArray, displayName: String): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveMediaStore(activity, bytes, displayName)
        } else {
            saveLegacy(activity, bytes, displayName)
        }
    }

    private fun saveMediaStore(activity: Activity, bytes: ByteArray, displayName: String): Boolean {
        val resolver = activity.contentResolver
        val values =
            ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    "${Environment.DIRECTORY_DOWNLOADS}/$FOLDER_NAME",
                )
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
        return try {
            resolver.openOutputStream(uri)?.use { out -> out.write(bytes) } ?: run {
                resolver.delete(uri, null, null)
                return false
            }
            val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
            resolver.update(uri, done, null, null)
            true
        } catch (e: Exception) {
            Log.e("PdfDownloadStorage", "saveMediaStore", e)
            try {
                resolver.delete(uri, null, null)
            } catch (_: Exception) {
                // no-op
            }
            false
        }
    }

    private fun saveLegacy(activity: Activity, bytes: ByteArray, displayName: String): Boolean {
        val base = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val dir = File(base, FOLDER_NAME)
        if (!dir.exists() && !dir.mkdirs()) {
            return false
        }
        val file = File(dir, displayName)
        return try {
            FileOutputStream(file).use { it.write(bytes) }
            MediaScannerConnection.scanFile(
                activity,
                arrayOf(file.absolutePath),
                arrayOf("application/pdf"),
                null,
            )
            true
        } catch (e: Exception) {
            Log.e("PdfDownloadStorage", "saveLegacy", e)
            false
        }
    }
}
