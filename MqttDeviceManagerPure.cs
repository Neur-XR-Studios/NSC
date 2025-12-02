using UnityEngine;
using UnityEngine.Events;
using System;
using System.Collections;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// ============================================================================
// PURE MQTT DEVICE MANAGER FOR UNITY
// ============================================================================
// This script implements the same MQTT protocol as mqtt-vr-device.html
// 
// REQUIRED: Install M2Mqtt package via NuGet or Unity Package Manager
// Option 1: Use M2MqttUnity from GitHub: https://github.com/gpvigano/M2MqttUnity
// Option 2: Use MQTTnet: https://github.com/dotnet/MQTTnet
//
// MQTT TOPICS USED:
// - devices/discovery/announce     (PUBLISH) - Announce device presence
// - devices/{deviceId}/status      (PUBLISH) - Device status updates
// - devices/{deviceId}/heartbeat   (PUBLISH) - Heartbeat every 5 seconds
// - devices/{deviceId}/events      (PUBLISH) - User-triggered events
// - devices/{deviceId}/lwt         (PUBLISH) - Last Will Testament (online/offline)
// - devices/{deviceId}/commands/+  (SUBSCRIBE) - Receive commands from admin
// - sessions/{sessionId}/commands/+ (SUBSCRIBE) - Receive session commands
// ============================================================================

public class MqttDeviceManagerPure : MonoBehaviour
{
    #region Configuration
    
    [Header("🔌 MQTT Connection Settings")]
    [Tooltip("MQTT Broker URL (without port)")]
    public string brokerAddress = "192.168.0.2";
    
    [Tooltip("MQTT Broker Port (usually 1883 for TCP, 9001 for WebSocket)")]
    public int brokerPort = 1883;
    
    [Tooltip("Device ID - leave empty for auto-generation")]
    public string deviceId = "";
    
    [Tooltip("Device Type: vr or chair")]
    public DeviceType deviceType = DeviceType.VR;
    
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
    
    // NOTE: Replace with your MQTT client implementation
    // Example using M2Mqtt: private MqttClient mqttClient;
    // Example using MQTTnet: private IMqttClient mqttClient;
    
    private float heartbeatTimer = 0f;
    private Coroutine heartbeatCoroutine;
    
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
    private string T_commands => $"devices/{deviceId}/commands/+";
    private string T_session_commands(string sid) => $"sessions/{sid}/commands/+";
    
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
                string prefix = deviceType == DeviceType.VR ? "VR_" : "CHAIR_";
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
    }
    
    void Update()
    {
        if (!_isConnected) return;
        
        // Update position if playing
        if (_isPlaying)
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
    /// Connect to MQTT broker
    /// </summary>
    public void Connect()
    {
        if (_isConnected)
        {
            Debug.LogWarning("[MQTT Device] Already connected");
            return;
        }
        
        Debug.Log($"[MQTT Device] Connecting to {brokerAddress}:{brokerPort}...");
        
        // ============================================================
        // TODO: IMPLEMENT YOUR MQTT CLIENT CONNECTION HERE
        // ============================================================
        // Example using M2Mqtt:
        // 
        // mqttClient = new MqttClient(brokerAddress, brokerPort, false, null, null, MqttSslProtocols.None);
        // mqttClient.MqttMsgPublishReceived += OnMqttMessageReceived;
        // 
        // string clientId = deviceId + "_" + DateTime.Now.Ticks;
        // 
        // // Set Last Will Testament (LWT)
        // mqttClient.Connect(clientId, "", "", true, 1, true, T_lwt, "offline", true, 60);
        // 
        // if (mqttClient.IsConnected)
        // {
        //     OnConnectedToMqtt();
        // }
        // ============================================================
        
        // For testing without MQTT library, simulate connection
        StartCoroutine(SimulateConnection());
    }
    
    private IEnumerator SimulateConnection()
    {
        yield return new WaitForSeconds(0.5f);
        OnConnectedToMqtt();
    }
    
    private void OnConnectedToMqtt()
    {
        _isConnected = true;
        Debug.Log("[MQTT Device] ✅ Connected to MQTT broker");
        
        // Subscribe to command topics
        Subscribe(T_commands);
        
        // If we have a saved session, subscribe to it
        string savedSession = PlayerPrefs.GetString("MQTT_SESSION_ID", "");
        if (!string.IsNullOrEmpty(savedSession))
        {
            _currentSessionId = savedSession;
            Subscribe(T_session_commands(savedSession));
        }
        
        // Announce device (retained)
        AnnounceDevice();
        
        // Send initial status (retained)
        SendStatus();
        
        // Clear LWT (mark as online)
        Publish(T_lwt, "online", retain: true);
        
        // Start heartbeat
        if (heartbeatCoroutine != null) StopCoroutine(heartbeatCoroutine);
        heartbeatCoroutine = StartCoroutine(HeartbeatLoop());
        
        OnConnected?.Invoke();
    }
    
    /// <summary>
    /// Disconnect from MQTT broker
    /// </summary>
    public void Disconnect()
    {
        if (!_isConnected) return;
        
        Debug.Log("[MQTT Device] Disconnecting...");
        
        // Publish offline LWT before disconnecting
        Publish(T_lwt, "offline", retain: true);
        
        // Stop heartbeat
        if (heartbeatCoroutine != null)
        {
            StopCoroutine(heartbeatCoroutine);
            heartbeatCoroutine = null;
        }
        
        // ============================================================
        // TODO: DISCONNECT YOUR MQTT CLIENT HERE
        // ============================================================
        // Example using M2Mqtt:
        // if (mqttClient != null && mqttClient.IsConnected)
        // {
        //     mqttClient.Disconnect();
        // }
        // ============================================================
        
        _isConnected = false;
        OnDisconnected?.Invoke();
    }
    
    #endregion
    
    #region MQTT Operations
    
    private void Subscribe(string topic)
    {
        if (!_isConnected) return;
        
        Debug.Log($"[MQTT Device] 📥 Subscribing to: {topic}");
        
        // ============================================================
        // TODO: IMPLEMENT MQTT SUBSCRIBE HERE
        // ============================================================
        // Example using M2Mqtt:
        // mqttClient.Subscribe(new string[] { topic }, new byte[] { 1 }); // QoS 1
        // ============================================================
    }
    
    private void Publish(string topic, string payload, bool retain = false)
    {
        if (!_isConnected) return;
        
        Debug.Log($"[MQTT Device] 📤 Publishing to {topic}: {payload.Substring(0, Math.Min(100, payload.Length))}...");
        
        // ============================================================
        // TODO: IMPLEMENT MQTT PUBLISH HERE
        // ============================================================
        // Example using M2Mqtt:
        // byte[] message = Encoding.UTF8.GetBytes(payload);
        // mqttClient.Publish(topic, message, 1, retain);
        // ============================================================
    }
    
    private void Publish(string topic, object payload, bool retain = false)
    {
        string json = JsonConvert.SerializeObject(payload);
        Publish(topic, json, retain);
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
        
        Publish(T_discovery_announce, payload, retain: true);
        Debug.Log("[MQTT Device] 📢 Device announced");
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
        
        Publish(T_status, payload, retain: true);
        Debug.Log($"[MQTT Device] 📊 Status: {status} @ {_currentPositionMs}ms");
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
        
        Publish(T_heartbeat, payload, retain: false);
    }
    
    #endregion
    
    #region Events (Device -> Admin)
    
    /// <summary>
    /// Send an event to the admin panel (e.g., play, pause, seek)
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
        
        // Merge extra properties if provided
        if (extra != null)
        {
            var extraObj = JObject.FromObject(extra);
            foreach (var prop in extraObj.Properties())
            {
                payload[prop.Name] = prop.Value;
            }
        }
        
        Publish(T_events, payload.ToString(), retain: false);
        Debug.Log($"[MQTT Device] 📤 Event: {eventName}");
    }
    
    /// <summary>
    /// Call this when user starts playback
    /// </summary>
    public void OnUserPlay()
    {
        _isPlaying = true;
        SendEvent("play");
        SendStatus();
    }
    
    /// <summary>
    /// Call this when user pauses playback
    /// </summary>
    public void OnUserPause()
    {
        _isPlaying = false;
        SendEvent("pause");
        SendStatus();
    }
    
    /// <summary>
    /// Call this when user seeks to a position
    /// </summary>
    public void OnUserSeek(float positionMs)
    {
        _currentPositionMs = positionMs;
        SendEvent("seek", new { positionMs = Mathf.FloorToInt(positionMs) });
    }
    
    /// <summary>
    /// Call this when playback ends
    /// </summary>
    public void OnPlaybackEnded()
    {
        _isPlaying = false;
        SendEvent("stop");
        SendStatus();
    }
    
    #endregion
    
    #region Session Management
    
    /// <summary>
    /// Join a session
    /// </summary>
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
        
        // Subscribe to session commands
        Subscribe(T_session_commands(sessionId));
        
        SendStatus();
        Debug.Log($"[MQTT Device] 🔗 Joined session: {sessionId}");
        
        OnSessionJoined?.Invoke(sessionId);
    }
    
    /// <summary>
    /// Leave current session
    /// </summary>
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
    
    /// <summary>
    /// Select a journey for playback
    /// </summary>
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
    
    #region Receiving Commands
    
    /// <summary>
    /// Called when MQTT message is received
    /// Override this or connect to your MQTT client's message handler
    /// </summary>
    public void OnMqttMessageReceived(string topic, string payload)
    {
        Debug.Log($"[MQTT Device] 📨 Received: {topic}");
        
        try
        {
            // Check if it's a command for this device
            string deviceCmdPrefix = $"devices/{deviceId}/commands/";
            if (topic.StartsWith(deviceCmdPrefix))
            {
                string command = topic.Substring(deviceCmdPrefix.Length);
                HandleCommand(command, payload);
                return;
            }
            
            // Check if it's a session command
            if (!string.IsNullOrEmpty(_currentSessionId))
            {
                string sessionCmdPrefix = $"sessions/{_currentSessionId}/commands/";
                if (topic.StartsWith(sessionCmdPrefix))
                {
                    string command = topic.Substring(sessionCmdPrefix.Length);
                    HandleCommand(command, payload);
                    return;
                }
            }
        }
        catch (Exception ex)
        {
            Debug.LogError($"[MQTT Device] Error handling message: {ex.Message}");
        }
    }
    
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
    
    /// <summary>
    /// Set current playback position (call from your video player)
    /// </summary>
    public void SetPosition(float positionMs)
    {
        _currentPositionMs = positionMs;
    }
    
    /// <summary>
    /// Set playing state (call from your video player)
    /// </summary>
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

public enum DeviceType
{
    VR,
    Chair
}
