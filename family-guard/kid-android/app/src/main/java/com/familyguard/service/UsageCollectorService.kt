package com.familyguard.service

import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.familyguard.data.DeviceRepository
import com.familyguard.data.LocalDb
import com.familyguard.data.UsageRepository
import com.familyguard.work.UploadWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class UsageCollectorService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val db by lazy { LocalDb.build(this) }
    private val usageRepository by lazy { UsageRepository(this, db) }
    private val deviceRepository by lazy { DeviceRepository(this) }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        scope.launch {
            runCatching {
                val deviceId = deviceRepository.getDeviceId()
                if (deviceId != null) {
                    usageRepository.collectAndPersist(deviceId)
                    scheduleUploads()
                }
            }.onFailure {
                Log.e(TAG, "Collection failed", it)
            }
        }
        return START_STICKY
    }

    private fun scheduleUploads() {
        val workRequest = PeriodicWorkRequestBuilder<UploadWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            "usage_upload",
            androidx.work.ExistingPeriodicWorkPolicy.UPDATE,
            workRequest,
        )
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "UsageCollector"

        fun ensurePermission(context: Context): Boolean {
            val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val end = System.currentTimeMillis()
            val start = end - TimeUnit.DAYS.toMillis(1)
            return manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end).isNotEmpty()
        }
    }
}
