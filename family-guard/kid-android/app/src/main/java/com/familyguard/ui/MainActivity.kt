package com.familyguard.ui

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.familyguard.BuildConfig
import com.familyguard.R
import com.familyguard.admin.DeviceAdminRcvr
import com.familyguard.data.DeviceRepository
import com.familyguard.service.HeartbeatService
import com.familyguard.service.UsageCollectorService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.TimeZone

class MainActivity : AppCompatActivity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient()
    private lateinit var statusView: TextView
    private lateinit var deviceRepository: DeviceRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        deviceRepository = DeviceRepository(this)

        val btnUsage = findViewById<Button>(R.id.btn_usage)
        val btnAdmin = findViewById<Button>(R.id.btn_device_admin)
        val btnStart = findViewById<Button>(R.id.btn_start)
        val btnPair = findViewById<Button>(R.id.btn_pair)
        val inputPair = findViewById<EditText>(R.id.input_pair)
        statusView = findViewById(R.id.status)

        btnUsage.setOnClickListener {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }

        btnAdmin.setOnClickListener {
            val component = ComponentName(this, DeviceAdminRcvr::class.java)
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, component)
                putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, getString(R.string.device_admin_enabled))
            }
            startActivity(intent)
        }

        btnStart.setOnClickListener {
            startService(Intent(this, HeartbeatService::class.java))
            startService(Intent(this, UsageCollectorService::class.java))
            statusView.text = getString(R.string.status_running)
        }

        btnPair.setOnClickListener {
            val code = inputPair.text.toString().trim()
            if (code.isEmpty()) {
                Toast.makeText(this, R.string.error_empty_code, Toast.LENGTH_SHORT).show()
            } else {
                pairWithCode(code)
            }
        }
    }

    private fun pairWithCode(code: String) {
        scope.launch {
            val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
            val payload = JSONObject().apply {
                put("pairing_code", code)
                put("device_id", androidId)
                put("tz", TimeZone.getDefault().id)
            }
            val request = Request.Builder()
                .url(BuildConfig.BASE_URL + BuildConfig.REGISTER_ENDPOINT)
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()
            val result = runCatching {
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw IllegalStateException("HTTP ${'$'}{response.code}")
                    val body = response.body?.string() ?: throw IllegalStateException("Empty body")
                    val json = JSONObject(body)
                    if (!json.optBoolean("ok")) throw IllegalStateException("Pair failed")
                    Triple(json.optString("device_id"), json.optString("child_id"), json.optString("device_key"))
                }
            }
            result.onSuccess { (deviceId, childId, deviceKey) ->
                deviceRepository.saveDevice(deviceId, deviceKey, childId, TimeZone.getDefault().id)
                runOnUiThread {
                    Toast.makeText(this@MainActivity, R.string.pair_success, Toast.LENGTH_LONG).show()
                    statusView.text = getString(R.string.status_paired)
                }
            }.onFailure { err ->
                runOnUiThread {
                    Toast.makeText(this@MainActivity, err.message ?: "Error", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
