package com.familyguard.data

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import com.familyguard.util.CategoryMap
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

private data class HourKey(val day: String, val hour: Int, val category: String)

private val Context.dataStore by preferencesDataStore(name = "family_guard")

object DevicePrefsKeys {
    val DEVICE_ID = stringPreferencesKey("device_id")
    val DEVICE_KEY = stringPreferencesKey("device_api_key")
    val CHILD_ID = stringPreferencesKey("child_id")
    val TIMEZONE = stringPreferencesKey("timezone")
}

data class UsageBatch(
    val daily: List<AppUsageEntity>,
    val hourly: List<HourlyBucketEntity>,
)

data class PendingSync(
    val daily: List<AppUsageEntity>,
    val hourly: List<HourlyBucketEntity>,
    val anomalies: List<AnomalyEntity>,
)

class DeviceRepository(private val context: Context) {
    suspend fun saveDevice(deviceId: String, deviceKey: String, childId: String, tz: String) {
        context.dataStore.edit { prefs ->
            prefs[DevicePrefsKeys.DEVICE_ID] = deviceId
            prefs[DevicePrefsKeys.DEVICE_KEY] = deviceKey
            prefs[DevicePrefsKeys.CHILD_ID] = childId
            prefs[DevicePrefsKeys.TIMEZONE] = tz
        }
    }

    suspend fun getDeviceId(): String? = context.dataStore.data.first()[DevicePrefsKeys.DEVICE_ID]
    suspend fun getDeviceKey(): String? = context.dataStore.data.first()[DevicePrefsKeys.DEVICE_KEY]
    suspend fun getChildId(): String? = context.dataStore.data.first()[DevicePrefsKeys.CHILD_ID]
    suspend fun getTimezone(): String? = context.dataStore.data.first()[DevicePrefsKeys.TIMEZONE]
}

class UsageRepository(private val context: Context, private val db: LocalDb) {
    private val formatter = DateTimeFormatter.ISO_LOCAL_DATE
    private val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    suspend fun collectAndPersist(deviceId: String): UsageBatch = withContext(Dispatchers.Default) {
        val end = System.currentTimeMillis()
        val start = end - TimeUnit.MINUTES.toMillis(15)
        val events = usageStatsManager.queryEvents(start, end)
        val daily = mutableMapOf<String, Int>()
        val hourly = mutableMapOf<HourKey, Int>()

        val categoryMap = CategoryMap(context)
        val activeSessions = mutableMapOf<String, Long>()
        val launches = mutableMapOf<String, Int>()
        val usageEvent = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(usageEvent)
            val pkg = usageEvent.packageName ?: continue
            when (usageEvent.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> {
                    activeSessions[pkg] = usageEvent.timeStamp
                    launches[pkg] = (launches[pkg] ?: 0) + 1
                }
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
                    val startTs = activeSessions.remove(pkg) ?: continue
                    accumulateUsage(pkg, startTs, usageEvent.timeStamp, daily, hourly, categoryMap)
                }
            }
        }

        // Close sessions still running
        val now = System.currentTimeMillis()
        activeSessions.forEach { (pkg, startTs) ->
            accumulateUsage(pkg, startTs, now, daily, hourly, categoryMap)
        }

        val dayKey = formatter.format(Instant.ofEpochMilli(end).atZone(ZoneId.systemDefault()))
        val dailyEntities = daily.map { (appId, minutes) ->
            AppUsageEntity(
                deviceId = deviceId,
                day = dayKey,
                appId = appId,
                category = categoryMap.categoryFor(appId),
                minutes = minutes,
                launches = launches[appId] ?: 0,
            )
        }

        val hourlyEntities = hourly.map { (key, minutes) ->
            HourlyBucketEntity(
                deviceId = deviceId,
                day = key.day,
                hour = key.hour,
                category = key.category,
                minutes = minutes,
            )
        }

        db.usageDao().upsertDaily(dailyEntities)
        db.usageDao().upsertHourly(hourlyEntities)

        UsageBatch(dailyEntities, hourlyEntities)
    }

    suspend fun pendingSync(): PendingSync = withContext(Dispatchers.IO) {
        val dao = db.usageDao()
        PendingSync(
            daily = dao.pendingDaily(),
            hourly = dao.pendingHourly(),
            anomalies = dao.pendingAnomalies(),
        )
    }

    suspend fun markUploaded(daily: List<AppUsageEntity>, hourly: List<HourlyBucketEntity>, anomalies: List<AnomalyEntity>) {
        val dao = db.usageDao()
        if (daily.isNotEmpty()) {
            dao.markDailyUploaded(daily.map { it.id })
        }
        if (hourly.isNotEmpty()) {
            hourly.forEach { dao.markHourlyUploaded(it.deviceId, it.day, it.hour, it.category) }
        }
        if (anomalies.isNotEmpty()) {
            dao.markAnomaliesUploaded(anomalies.map { it.id })
        }
    }

    suspend fun enqueueAnomaly(event: AnomalyEntity) {
        db.usageDao().upsertAnomaly(listOf(event))
    }
}

private fun accumulateUsage(
    packageName: String,
    startTs: Long,
    endTs: Long,
    daily: MutableMap<String, Int>,
    hourly: MutableMap<HourKey, Int>,
    categoryMap: CategoryMap,
) {
    if (endTs <= startTs) return
    val durationMinutes = TimeUnit.MILLISECONDS.toMinutes(endTs - startTs).toInt().coerceAtLeast(1)
    val zoned = Instant.ofEpochMilli(startTs).atZone(ZoneId.systemDefault())
    val day = DateTimeFormatter.ISO_LOCAL_DATE.format(zoned)
    val hour = zoned.hour
    val category = categoryMap.categoryFor(packageName)

    val current = daily[packageName] ?: 0
    daily[packageName] = current + durationMinutes

    val hourKey = HourKey(day, hour, category)
    hourly[hourKey] = (hourly[hourKey] ?: 0) + durationMinutes
}
