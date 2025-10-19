package com.familyguard.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

object NetUtils {
    fun snapshot(context: Context): Map<String, Any?> {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return mapOf("status" to "offline")
        val caps = cm.getNetworkCapabilities(network)
        val transports = mutableListOf<String>()
        if (caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true) transports.add("wifi")
        if (caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true) transports.add("cell")
        if (caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true) transports.add("vpn")
        return mapOf(
            "status" to "online",
            "transports" to transports,
            "metered" to (caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) == false),
        )
    }
}
