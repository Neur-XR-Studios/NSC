using UnityEngine;
using UnityEngine.Events;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// ============================================================================
// MQTT DEVICE MANAGER FOR UNITY - USING SOCKET.IO BRIDGE
// ============================================================================
// This connects to your backend's Socket.IO bridge (port 8001) which forwards
// messages to MQTT. NO EXTERNAL PACKAGES REQUIRED!
//
// How it works:
// 1. Unity connects to backend via HTTP polling (simple GET/POST)
// 2. Backend forwards messages to MQTT broker
// 3. Device appears online in admin panel
// ============================================================================

public class MqttDeviceManagerWebSocket : MonoBehaviour
{
    #region Configuration

    [Header("🔌 Connection Settings")]
    [Tooltip("Backend server URL (e.g., 192.168.0.190)")]
    public string serverAddress = "192.168.0.190";

    [Tooltip("Backend HTTP port (usually 8001)")]
    public int serverPort = 8001;

    [Tooltip("Device ID - leave empty for auto-generation")]
    public string deviceId = "";

    [Tooltip("Device Type: vr or chair")]
    public DeviceTypeEnum deviceType = DeviceTypeEnum.VR;

    [Tooltip("Optional device display name")]
    public string displayName = "";

    [Header("📊 Status (Read-Only)")]
    [SerializeField] private bool _isConnected = false;
    [SerializeField] private bool _isPlaying = false;
    [SerializeField] private string _currentSessionId = "";
    [SerializeField] private string _currentJourneyId = "";
    [SerializeField] private float _currentPositionMs = 0f;
    [SerializeField] private string _currentLanguage = "";

    [Header("⏱ Timing")]
    [Tooltip("Heartbeat interval in seconds")]
    public float heartbeatInterval = 5f;

    [Header("🎮 Unity Events")]
    public UnityEvent OnConnected;
    public UnityEvent OnDisconnected;
    public UnityEvent OnPlayCommand;
    public UnityEvent OnPauseCommand;
    public UnityEvent OnStopCommand;
    public UnityEvent OnCalibrateCommand;
    public UnityEvent<float> OnSeekCommand;
    public UnityEvent<string> OnSessionJoined;
    public UnityEvent OnSessionLeft;
    public UnityEvent<int> OnJourneySelected;
    public UnityEvent<string> OnLanguageChanged;

    #endregion

    #region Private Fields

    private Coroutine heartbeatCoroutine;
    private Coroutine pollingCoroutine;
    private string baseUrl => $"http://{serverAddress}:{serverPort}";

    #endregion

    #region Public Properties

    public bool IsConnected => _isConnected;
    public bool IsPlaying => _isPlaying;
    public float CurrentPositionMs => _currentPositionMs;
    public string CurrentSessionId => _currentSessionId;
    public string CurrentJourneyId => _currentJourneyId;
    public string DeviceId => deviceId;
    public string DeviceTypeString => deviceType.ToString().ToLower();

    #endregion

    #region MQTT Topics

    private string T_discovery_announce => "devices/discovery/announce";
    private string T_status => $"devices/{deviceId}/status";
    private string T_heartbeat => $"devices/{deviceId}/heartbeat";
    private string T_events => $"devices/{deviceId}/events";
    private string T_lwt => $"devices/{deviceId}/lwt";

    #endregion

    #region Unity Lifecycle

    void Start()
    {
        // Generate device ID if not set
        if (string.IsNullOrEmpty(deviceId))
        {
            deviceId = PlayerPrefs.GetString("MQTT_DEVICE_ID", "");
            if (string.IsNullOrEmpty(deviceId))
            {
                string prefix = deviceType == DeviceTypeEnum.VR ? "VR_" : "CHAIR_";
                deviceId = prefix + Guid.NewGuid().ToString().Substring(0, 8).ToUpper();
                PlayerPrefs.SetString("MQTT_DEVICE_ID", deviceId);
                PlayerPrefs.Save();
            }
        }

        if (string.IsNullOrEmpty(displayName))
        {
            displayName = deviceId;
        }

        Debug.Log($"[MQTT Device] ID: {deviceId}, Type: {DeviceTypeString}");

        // Auto-connect on start
        Connect();
    }

    void Update()
    {
        // Update position if playing
        if (_isConnected && _isPlaying)
        {
            _currentPositionMs += Time.deltaTime * 1000f;
        }
    }

    void OnDestroy()
    {
        Disconnect();
    }

    void OnApplicationQuit()
    {
        Disconnect();
    }

    #endregion

    #region Connection

    /// <summary>
    /// Connect to backend and start sending heartbeats
    /// </summary>
    public void Connect()
    {
        if (_isConnected)
        {
            Debug.LogWarning("[MQTT Device] Already connected");
            return;
        }

        Debug.Log("========================================");
        Debug.Log("[MQTT Device] 🚀 STARTING CONNECTION...");
        Debug.Log($"[MQTT Device] Server: {serverAddress}:{serverPort}");
        Debug.Log($"[MQTT Device] Base URL: {baseUrl}");
        Debug.Log($"[MQTT Device] Device ID: {deviceId}");
        Debug.Log($"[MQTT Device] Device Type: {DeviceTypeString}");
        Debug.Log("========================================");

        // Test connection first
        StartCoroutine(TestConnectionAndConnect());
    }
    
    private IEnumerator TestConnectionAndConnect()
    {
        // First test if backend is reachable
        string testUrl = $"{baseUrl}/api/mqtt/publish";
        Debug.Log($"[MQTT Device] 🔍 Testing connection to: {testUrl}");
        
        var testPayload = new
        {
            topic = "test/unity/ping",
            payload = $"{{\"deviceId\":\"{deviceId}\",\"test\":true,\"timestamp\":\"{GetTimestamp()}\"}}",
            retain = false
        };
        
        string jsonBody = JsonConvert.SerializeObject(testPayload);
        byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
        
        using (var request = new UnityEngine.Networking.UnityWebRequest(testUrl, "POST"))
        {
            request.uploadHandler = new UnityEngine.Networking.UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new UnityEngine.Networking.DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 10;
            
            Debug.Log($"[MQTT Device] 📤 Sending test request...");
            
            yield return request.SendWebRequest();
            
            Debug.Log($"[MQTT Device] Response Code: {request.responseCode}");
            Debug.Log($"[MQTT Device] Response: {request.downloadHandler.text}");
            
            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                Debug.Log("[MQTT Device] ✅ Backend connection successful!");
                
                // Mark as connected and start operations
                _isConnected = true;
                
                // Announce device
                Debug.Log("[MQTT Device] 📢 Announcing device...");
                AnnounceDevice();
                
                // Send initial status
                Debug.Log("[MQTT Device] 📊 Sending initial status...");
                SendStatus();
                
                // Publish online LWT
                Debug.Log("[MQTT Device] 🟢 Publishing online LWT...");
                PublishMessage(T_lwt, "online", true);
                
                // Start heartbeat
                if (heartbeatCoroutine != null) StopCoroutine(heartbeatCoroutine);
                heartbeatCoroutine = StartCoroutine(HeartbeatLoop());
                Debug.Log("[MQTT Device] ❤️ Heartbeat started!");
                
                // Start polling for commands
                if (pollingCoroutine != null) StopCoroutine(pollingCoroutine);
                pollingCoroutine = StartCoroutine(PollForCommands());
                
                OnConnected?.Invoke();
                Debug.Log("[MQTT Device] ✅ FULLY CONNECTED AND RUNNING!");
            }
            else
            {
                Debug.LogError("========================================");
                Debug.LogError("[MQTT Device] ❌ CONNECTION FAILED!");
                Debug.LogError($"[MQTT Device] Error: {request.error}");
                Debug.LogError($"[MQTT Device] Result: {request.result}");
                Debug.LogError($"[MQTT Device] Response Code: {request.responseCode}");
                Debug.LogError($"[MQTT Device] URL: {testUrl}");
                Debug.LogError("========================================");
                Debug.LogError("[MQTT Device] 💡 TROUBLESHOOTING:");
                Debug.LogError($"  1. Is backend running at {baseUrl}?");
                Debug.LogError($"  2. Can you access {baseUrl} from browser?");
                Debug.LogError($"  3. Check firewall settings");
                Debug.LogError($"  4. Verify serverAddress and serverPort in Inspector");
                Debug.LogError("========================================");
            }
        }
    }

    /// <summary>
    /// Disconnect from backend
    /// </summary>
    public void Disconnect()
    {
        if (!_isConnected) return;

        Debug.Log("[MQTT Device] Disconnecting...");

        // Publish offline LWT
        PublishMessage(T_lwt, "offline", true);

        // Stop coroutines
        if (heartbeatCoroutine != null)
        {
            StopCoroutine(heartbeatCoroutine);
            heartbeatCoroutine = null;
        }

        if (pollingCoroutine != null)
        {
            StopCoroutine(pollingCoroutine);
            pollingCoroutine = null;
        }

        _isConnected = false;
        OnDisconnected?.Invoke();
    }

    #endregion

    #region MQTT Operations via HTTP

    /// <summary>
    /// Publish a message to MQTT via backend HTTP API
    /// </summary>
    private void PublishMessage(string topic, string payload, bool retain = false)
    {
        if (!_isConnected) return;

        StartCoroutine(PublishCoroutine(topic, payload, retain));
    }

    private IEnumerator PublishCoroutine(string topic, string payload, bool retain)
    {
        string url = $"{baseUrl}/api/mqtt/publish";

        var requestBody = new
        {
            topic = topic,
            payload = payload,
            retain = retain
        };

        string jsonBody = JsonConvert.SerializeObject(requestBody);
        byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);

        Debug.Log($"[MQTT Device] 📤 Publishing to: {topic}");
        Debug.Log($"[MQTT Device] 📤 Payload: {payload.Substring(0, Math.Min(200, payload.Length))}");

        using (var request = new UnityEngine.Networking.UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UnityEngine.Networking.UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new UnityEngine.Networking.DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 10;

            yield return request.SendWebRequest();

            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                Debug.Log($"[MQTT Device] ✅ Published to {topic} - Response: {request.downloadHandler.text}");
            }
            else
            {
                Debug.LogError($"[MQTT Device] ❌ Publish FAILED to {topic}");
                Debug.LogError($"[MQTT Device] Error: {request.error}");
                Debug.LogError($"[MQTT Device] Response Code: {request.responseCode}");
                Debug.LogError($"[MQTT Device] Response: {request.downloadHandler.text}");
            }
        }
    }

    private IEnumerator PollForCommands()
    {
        while (_isConnected)
        {
            yield return new WaitForSeconds(2f);

            string url = $"{baseUrl}/api/mqtt/commands/{deviceId}";

            using (var request = UnityEngine.Networking.UnityWebRequest.Get(url))
            {
                yield return request.SendWebRequest();

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    string response = request.downloadHandler.text;
                    if (!string.IsNullOrEmpty(response) && response != "[]")
                    {
                        try
                        {
                            var commands = JsonConvert.DeserializeObject<List<CommandMessage>>(response);
                            foreach (var cmd in commands)
                            {
                                HandleCommand(cmd.command, cmd.payload);
                            }
                        }
                        catch (Exception ex)
                        {
                            Debug.LogWarning($"[MQTT Device] Command parse error: {ex.Message}");
                        }
                    }
                }
            }
        }
    }

    [Serializable]
    private class CommandMessage
    {
        public string command;
        public string payload;
    }

    #endregion

    #region Device Announcement & Status

    /// <summary>
    /// Announce device presence to the system
    /// </summary>
    public void AnnounceDevice()
    {
        var payload = new
        {
            deviceId = deviceId,
            type = DeviceTypeString,
            name = displayName,
            display_name = displayName,
            status = "idle",
            online = true,
            timestamp = GetTimestamp()
        };

        string json = JsonConvert.SerializeObject(payload);
        PublishMessage(T_discovery_announce, json, true);
        Debug.Log($"[MQTT Device] 📢 Device announced: {json}");
    }

    /// <summary>
    /// Send current device status
    /// </summary>
    public void SendStatus()
    {
        string status = _isPlaying ? "active" : "idle";

        var payload = new
        {
            deviceId = deviceId,
            type = DeviceTypeString,
            status = status,
            positionMs = Mathf.FloorToInt(_currentPositionMs),
            sessionId = _currentSessionId ?? "",
            journeyId = _currentJourneyId ?? "",
            language = _currentLanguage ?? "",
            display_name = displayName,
            timestamp = GetTimestamp()
        };

        string json = JsonConvert.SerializeObject(payload);
        PublishMessage(T_status, json, true);
        Debug.Log($"[MQTT Device] 📊 Status sent: {json}");
    }

    private IEnumerator HeartbeatLoop()
    {
        while (_isConnected)
        {
            yield return new WaitForSeconds(heartbeatInterval);
            SendHeartbeat();
        }
    }

    private void SendHeartbeat()
    {
        string status = _isPlaying ? "active" : "idle";

        var payload = new
        {
            deviceId = deviceId,
            type = DeviceTypeString,
            status = status,
            timestamp = GetTimestamp()
        };

        string json = JsonConvert.SerializeObject(payload);
        PublishMessage(T_heartbeat, json, false);
        Debug.Log($"[MQTT Device] ❤️ Heartbeat: {json}");
    }

    #endregion

    #region Events (Device -> Admin)

    /// <summary>
    /// Send an event to the admin panel
    /// </summary>
    public void SendEvent(string eventName, object extra = null)
    {
        var payload = new JObject
        {
            ["deviceId"] = deviceId,
            ["type"] = DeviceTypeString,
            ["event"] = eventName,
            ["positionMs"] = Mathf.FloorToInt(_currentPositionMs),
            ["sessionId"] = _currentSessionId ?? "",
            ["journeyId"] = _currentJourneyId ?? "",
            ["language"] = _currentLanguage ?? "",
            ["timestamp"] = GetTimestamp()
        };

        if (extra != null)
        {
            var extraObj = JObject.FromObject(extra);
            foreach (var prop in extraObj.Properties())
            {
                payload[prop.Name] = prop.Value;
            }
        }

        PublishMessage(T_events, payload.ToString(), false);
        Debug.Log($"[MQTT Device] 📤 Event: {eventName}");
    }

    public void OnUserPlay()
    {
        _isPlaying = true;
        SendEvent("play");
        SendStatus();
    }

    public void OnUserPause()
    {
        _isPlaying = false;
        SendEvent("pause");
        SendStatus();
    }

    public void OnUserSeek(float positionMs)
    {
        _currentPositionMs = positionMs;
        SendEvent("seek", new { positionMs = Mathf.FloorToInt(positionMs) });
    }

    public void OnPlaybackEnded()
    {
        _isPlaying = false;
        SendEvent("stop");
        SendStatus();
    }

    #endregion

    #region Session Management

    public void JoinSession(string sessionId)
    {
        if (string.IsNullOrEmpty(sessionId))
        {
            Debug.LogError("[MQTT Device] Session ID is empty");
            return;
        }

        _currentSessionId = sessionId;
        PlayerPrefs.SetString("MQTT_SESSION_ID", sessionId);
        PlayerPrefs.Save();

        SendStatus();
        Debug.Log($"[MQTT Device] 🔗 Joined session: {sessionId}");
        OnSessionJoined?.Invoke(sessionId);
    }

    public void LeaveSession()
    {
        string oldSession = _currentSessionId;
        _currentSessionId = "";

        PlayerPrefs.DeleteKey("MQTT_SESSION_ID");
        PlayerPrefs.Save();

        SendStatus();
        Debug.Log($"[MQTT Device] 🔓 Left session: {oldSession}");
        OnSessionLeft?.Invoke();
    }

    public void SelectJourney(int journeyId, string language = "")
    {
        _currentJourneyId = journeyId.ToString();
        _currentLanguage = language;
        _currentPositionMs = 0;

        SendEvent("select_journey", new { journeyId = journeyId, language = language });
        SendStatus();
        Debug.Log($"[MQTT Device] 🎬 Selected journey: {journeyId}");
    }

    #endregion

    #region Command Handling

    private void HandleCommand(string command, string payloadJson)
    {
        Debug.Log($"[MQTT Device] ⚙️ Command: {command}");

        JObject data = null;
        try
        {
            if (!string.IsNullOrEmpty(payloadJson))
            {
                data = JObject.Parse(payloadJson);
            }
        }
        catch { }

        switch (command.ToLower())
        {
            case "play":
            case "start":
            case "resume":
                _isPlaying = true;
                OnPlayCommand?.Invoke();
                SendStatus();
                break;

            case "pause":
                _isPlaying = false;
                OnPauseCommand?.Invoke();
                SendStatus();
                break;

            case "stop":
                _isPlaying = false;
                _currentPositionMs = 0;
                OnStopCommand?.Invoke();
                SendStatus();
                break;

            case "calibrate":
                OnCalibrateCommand?.Invoke();
                break;

            case "seek":
                if (data != null && data["positionMs"] != null)
                {
                    float pos = data["positionMs"].Value<float>();
                    _currentPositionMs = pos;
                    OnSeekCommand?.Invoke(pos);
                    SendStatus();
                }
                break;

            case "select_journey":
            case "load_journey":
                if (data != null && data["journeyId"] != null)
                {
                    int journeyId = data["journeyId"].Value<int>();
                    string language = data["language"]?.Value<string>() ?? "";

                    _currentJourneyId = journeyId.ToString();
                    _currentLanguage = language;
                    _currentPositionMs = 0;

                    OnJourneySelected?.Invoke(journeyId);
                    if (!string.IsNullOrEmpty(language))
                    {
                        OnLanguageChanged?.Invoke(language);
                    }
                    SendStatus();
                }
                break;

            case "join_session":
                if (data != null && data["sessionId"] != null)
                {
                    string sessionId = data["sessionId"].Value<string>();
                    JoinSession(sessionId);
                }
                break;

            default:
                Debug.LogWarning($"[MQTT Device] Unknown command: {command}");
                break;
        }
    }

    #endregion

    #region Helpers

    private string GetTimestamp()
    {
        return DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
    }

    public void SetPosition(float positionMs)
    {
        _currentPositionMs = positionMs;
    }

    public void SetPlaying(bool playing)
    {
        if (_isPlaying != playing)
        {
            _isPlaying = playing;
            SendStatus();
        }
    }

    #endregion
}

public enum DeviceTypeEnum
{
    VR,
    Chair
}
