package com.familyguard.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Upsert
import androidx.room.Query
import java.time.Instant

@Entity(tableName = "app_usage_daily")
data class AppUsageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val deviceId: String,
    val day: String,
    val appId: String,
    val category: String,
    val minutes: Int,
    val launches: Int,
    val uploaded: Boolean = false,
)

@Entity(tableName = "hourly_buckets", primaryKeys = ["deviceId", "day", "hour", "category"])
data class HourlyBucketEntity(
    val deviceId: String,
    val day: String,
    val hour: Int,
    val category: String,
    val minutes: Int,
    val uploaded: Boolean = false,
)

@Entity(tableName = "anomaly_events")
data class AnomalyEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val deviceId: String,
    val eventType: String,
    val detail: String?,
    val occurredAt: Instant,
    val uploaded: Boolean = false,
)

@Dao
interface UsageDao {
    @Upsert
    suspend fun upsertDaily(list: List<AppUsageEntity>)

    @Query("SELECT * FROM app_usage_daily WHERE uploaded = 0 LIMIT 100")
    suspend fun pendingDaily(): List<AppUsageEntity>

    @Query("UPDATE app_usage_daily SET uploaded = 1 WHERE id IN (:ids)")
    suspend fun markDailyUploaded(ids: List<Long>)

    @Upsert
    suspend fun upsertHourly(list: List<HourlyBucketEntity>)

    @Query("SELECT * FROM hourly_buckets WHERE uploaded = 0 LIMIT 100")
    suspend fun pendingHourly(): List<HourlyBucketEntity>

    @Query("UPDATE hourly_buckets SET uploaded = 1 WHERE deviceId = :deviceId AND day = :day AND hour = :hour AND category = :category")
    suspend fun markHourlyUploaded(deviceId: String, day: String, hour: Int, category: String)

    @Upsert
    suspend fun upsertAnomaly(events: List<AnomalyEntity>)

    @Query("SELECT * FROM anomaly_events WHERE uploaded = 0 LIMIT 50")
    suspend fun pendingAnomalies(): List<AnomalyEntity>

    @Query("UPDATE anomaly_events SET uploaded = 1 WHERE id IN (:ids)")
    suspend fun markAnomaliesUploaded(ids: List<Long>)
}

@Database(
    entities = [AppUsageEntity::class, HourlyBucketEntity::class, AnomalyEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class LocalDb : RoomDatabase() {
    abstract fun usageDao(): UsageDao

    companion object {
        fun build(context: Context): LocalDb = Room.databaseBuilder(
            context.applicationContext,
            LocalDb::class.java,
            "family_guard.db",
        ).fallbackToDestructiveMigration().build()
    }
}
