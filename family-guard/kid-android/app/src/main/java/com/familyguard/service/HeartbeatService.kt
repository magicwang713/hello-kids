package com.familyguard.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.familyguard.BuildConfig
import com.familyguard.R
import com.familyguard.data.AnomalyEntity
import com.familyguard.data.DeviceRepository
import com.familyguard.data.LocalDb
import com.familyguard.data.UsageRepository
import com.familyguard.ui.MainActivity
import com.familyguard.util.NetUtils
import com.familyguard.work.UploadWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

class HeartbeatService : LifecycleService() {
    private val channelId = "family_guard_heartbeat"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient()
    private val db by lazy { LocalDb.build(this) }
    private val usageRepository by lazy { UsageRepository(this, db) }
    private val deviceRepository by lazy { DeviceRepository(this) }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(1001, buildNotification())
        scope.launch {
            while (true) {
                sendHeartbeat()
                scheduleUpload()
                delay(TimeUnit.MINUTES.toMillis(5))
            }
        }
    }

    private fun createChannel() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(channelId, getString(R.string.notification_channel_name), NotificationManager.IMPORTANCE_LOW).apply {
            description = getString(R.string.notification_channel_description)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val intent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_body))
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(intent)
            .setOngoing(true)
            .build()
    }

    private suspend fun sendHeartbeat() {
        val deviceId = deviceRepository.getDeviceId() ?: return
        val deviceKey = deviceRepository.getDeviceKey() ?: return
        val payload = JSONObject().apply {
            put("device_id", deviceId)
            put("event_type", "heartbeat")
            put("occurred_at", Instant.now().toString())
            put("detail", JSONObject().apply {
                put("network", JSONObject(NetUtils.snapshot(this@HeartbeatService)))
            })
        }
        val request = Request.Builder()
            .url(BuildConfig.BASE_URL + BuildConfig.HEARTBEAT_ENDPOINT)
            .header("X-Device-Key", deviceKey)
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    enqueueHeartbeatTimeout(deviceId)
                }
            }
        } catch (ex: Exception) {
            enqueueHeartbeatTimeout(deviceId)
        }
    }

    private suspend fun enqueueHeartbeatTimeout(deviceId: String) {
        val anomaly = AnomalyEntity(
            deviceId = deviceId,
            eventType = "heartbeat_timeout",
            detail = JSONObject().apply { put("reason", "network_failure") }.toString(),
            occurredAt = Instant.now(),
        )
        usageRepository.enqueueAnomaly(anomaly)
    }

    private fun scheduleUpload() {
        val request = OneTimeWorkRequestBuilder<UploadWorker>().build()
        WorkManager.getInstance(applicationContext).enqueue(request)
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }
}
