package com.familyguard.util

import android.content.Context
import org.json.JSONObject
import java.io.BufferedReader

class CategoryMap(private val context: Context) {
    private val cache: MutableMap<String, String> = mutableMapOf()
    private val defaults = mapOf(
        "com.tencent.mm" to "social",
        "com.google.android.youtube" to "short_video",
        "com.ss.android.ugc.aweme" to "short_video",
        "com.roblox.client" to "game",
        "com.supercell.clashofclans" to "game",
        "com.google.android.apps.docs" to "study",
        "com.duolingo" to "study",
        "com.microsoft.office.word" to "study",
        "com.android.chrome" to "other",
    )

    fun categoryFor(packageName: String): String {
        return cache[packageName] ?: loadFromAssets(packageName) ?: defaults[packageName] ?: "other"
    }

    private fun loadFromAssets(packageName: String): String? {
        return try {
            val inputStream = context.assets.open("category_map.json")
            val text = inputStream.bufferedReader().use(BufferedReader::readText)
            val json = JSONObject(text)
            val value = json.optString(packageName)
            if (value.isNotEmpty()) {
                cache[packageName] = value
                value
            } else {
                null
            }
        } catch (ex: Exception) {
            null
        }
    }
}
