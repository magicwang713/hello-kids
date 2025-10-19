package com.familyguard.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.familyguard.service.HeartbeatService
import com.familyguard.service.UsageCollectorService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        context.startService(Intent(context, HeartbeatService::class.java))
        context.startService(Intent(context, UsageCollectorService::class.java))
    }
}
