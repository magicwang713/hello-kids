package com.familyguard.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.familyguard.BuildConfig
import com.familyguard.data.DeviceRepository
import com.familyguard.data.LocalDb
import com.familyguard.data.UsageRepository
import com.familyguard.util.NetUtils
import com.squareup.moshi.Moshi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.time.Instant

class UploadWorker(appContext: Context, workerParams: WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    private val db by lazy { LocalDb.build(appContext) }
    private val usageRepository by lazy { UsageRepository(appContext, db) }
    private val deviceRepository by lazy { DeviceRepository(appContext) }
    private val client = OkHttpClient()
    private val moshi = Moshi.Builder().build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val deviceId = deviceRepository.getDeviceId() ?: return@withContext Result.retry()
        val deviceKey = deviceRepository.getDeviceKey() ?: return@withContext Result.retry()
        val pending = usageRepository.pendingSync()

        if (pending.daily.isNotEmpty() || pending.hourly.isNotEmpty()) {
            val day = pending.daily.firstOrNull()?.day ?: Instant.now().toString().substring(0, 10)
            val usagePayload = mapOf(
                "device_id" to deviceId,
                "day" to day,
                "apps" to pending.daily.map {
                    mapOf(
                        "app_id" to it.appId,
                        "category" to it.category,
                        "minutes" to it.minutes,
                        "launches" to it.launches,
                    )
                },
                "hours" to pending.hourly.map {
                    mapOf(
                        "hour" to it.hour,
                        "category" to it.category,
                        "minutes" to it.minutes,
                    )
                },
            )
            client.newCall(
                Request.Builder()
                    .url(BuildConfig.BASE_URL + BuildConfig.USAGE_ENDPOINT)
                    .header("X-Device-Key", deviceKey)
                    .post(moshi.adapter(Map::class.java).toJson(usagePayload).toRequestBody(JSON))
                    .build(),
            ).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.retry()
                }
            }
            usageRepository.markUploaded(pending.daily, pending.hourly, emptyList())
        }

        if (pending.anomalies.isNotEmpty()) {
            pending.anomalies.forEach { anomaly ->
                val detailJson = anomaly.detail ?: "{}"
                val payload = JSONObject(detailJson)
                payload.put("network_snapshot", JSONObject(NetUtils.snapshot(applicationContext)))
                payload.put("device_id", anomaly.deviceId)
                payload.put("event_type", anomaly.eventType)
                payload.put("occurred_at", anomaly.occurredAt.toString())
                val request = Request.Builder()
                    .url(BuildConfig.BASE_URL + BuildConfig.ANOMALY_ENDPOINT)
                    .header("X-Device-Key", deviceKey)
                    .post(payload.toString().toRequestBody(JSON))
                    .build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        return@withContext Result.retry()
                    }
                }
            }
            usageRepository.markUploaded(emptyList(), emptyList(), pending.anomalies)
        }

        Result.success()
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
