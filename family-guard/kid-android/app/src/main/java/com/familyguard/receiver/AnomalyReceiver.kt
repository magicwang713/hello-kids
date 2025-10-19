package com.familyguard.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import com.familyguard.data.AnomalyEntity
import com.familyguard.data.DeviceRepository
import com.familyguard.data.LocalDb
import com.familyguard.data.UsageRepository
import com.familyguard.util.NetUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant

class AnomalyReceiver : BroadcastReceiver() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        scope.launch {
            val db = LocalDb.build(context)
            val usageRepo = UsageRepository(context, db)
            val deviceRepo = DeviceRepository(context)
            val deviceId = deviceRepo.getDeviceId() ?: return@launch
            val detail = JSONObject().apply {
                put("action", action)
                put("package", intent.data?.schemeSpecificPart)
                put("network", JSONObject(NetUtils.snapshot(context)))
            }
            when (action) {
                Intent.ACTION_PACKAGE_REMOVED -> {
                    val replacing = intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)
                    if (!replacing) {
                        usageRepo.enqueueAnomaly(
                            AnomalyEntity(
                                deviceId = deviceId,
                                eventType = "uninstall_attempt",
                                detail = detail.toString(),
                                occurredAt = Instant.now(),
                            ),
                        )
                    }
                }
                Intent.ACTION_PACKAGE_ADDED -> {
                    usageRepo.enqueueAnomaly(
                        AnomalyEntity(
                            deviceId = deviceId,
                            eventType = "package_added",
                            detail = detail.toString(),
                            occurredAt = Instant.now(),
                        ),
                    )
                }
                Intent.ACTION_PACKAGE_CHANGED -> {
                    usageRepo.enqueueAnomaly(
                        AnomalyEntity(
                            deviceId = deviceId,
                            eventType = "package_changed",
                            detail = detail.toString(),
                            occurredAt = Instant.now(),
                        ),
                    )
                }
            }
        }
    }
}
