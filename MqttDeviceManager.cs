using UnityEngine;
using UnityEngine.Events;
using SocketIOClient;
using SocketIOClient.Transport;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;
using UnityEngine.SceneManagement;
using System.Collections;

public class MqttDeviceManager : MonoBehaviour
{
    #region Configuration
    public string name;
    public string _response;
    [SerializeField] public string _currentJourneyId = "";
    [SerializeField] public string _currentSessionId = "";
    [SerializeField] public float _currentPositionMs = 0f;
    [Header("🔌 Connection Settings")]
    [Tooltip("Backend Socket.IO URL")]
    public string backendUrl = "http://192.168.0.192:8001"; // ← YOUR MQTT URL HERE

    [Tooltip("Device ID - leave empty for auto-generation")]
    public string deviceId = "";

    [Tooltip("Device Type: vr or chair")]
    public MqttDeviceType deviceType = MqttDeviceType.VR;

    [Tooltip("Optional device name")]
    public string deviceName = "";

    [Header("📊 Status (Read-Only)")]
    [SerializeField] private bool _isConnected = false;
    [SerializeField] private bool _isPlaying = false;
    [SerializeField] private List<string> _activeSessions = new List<string>();
    [SerializeField] private string _sessionType = ""; // "group" or "individual"
    [SerializeField] private string _participantId = ""; // for individual mode

    [Header("⏱ Timing")]
    [Tooltip("Heartbeat interval in seconds")]
    public float heartbeatInterval = 1f;

    [Tooltip("Position update interval for individual sync (seconds)")]
    public float positionUpdateInterval = 2f;

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
    public UnityEvent<string> OnJourneySelected;
    public UnityEvent<string> OnSessionTypeReceived; // "group" or "individual"

    private Coroutine syncCoroutine;
    private bool isPlaying = false;
    #endregion

    #region Private Fields

    private SocketIOUnity socket;
    private float heartbeatTimer = 0f;
    private float positionUpdateTimer = 0f;
    private const string STORAGE_KEY = "nsc_device_session";
    private UnityMainThreadDispatcher dispatcher;

    #endregion

    #region Public Properties

    public bool IsConnected => _isConnected;
    public bool IsPlaying => _isPlaying;
    public float CurrentPositionMs => _currentPositionMs;
    public string CurrentSessionId => _currentSessionId;
    public string DeviceId => deviceId;
    public string DeviceTypeString => deviceType.ToString().ToLower();
    public List<string> ActiveSessions => _activeSessions;
    public string SessionType => _sessionType;
    public string ParticipantId => _participantId;
    public string CurrentJourneyId => _currentJourneyId;

    #endregion

    #region Unity Lifecycle

    void Start()
    {
        dispatcher = UnityMainThreadDispatcher.Instance();
        if (string.IsNullOrEmpty(deviceId))
        {
            deviceId = PlayerPrefs.GetString("VR_ID", "");
            // Fallback device ID generation if needed, ensure it's saved/unique
            if (string.IsNullOrEmpty(deviceId))
            {
                deviceId = "VR_" + Guid.NewGuid().ToString().Substring(0, 8).ToUpper();
                PlayerPrefs.SetString("VR_ID", deviceId);
                PlayerPrefs.Save();
            }
            Debug.Log($"[Device] Generated ID: {deviceId}");
        }
    }

    void Update()
    {
        if (!_isConnected) return;
        
        if (Input.GetKeyDown(KeyCode.Space))
        {
            ConnectToBackend();
        }

        if (_isPlaying)
        {
            float deltaMs = Time.deltaTime * 1000f;
            _currentPositionMs += deltaMs;

            // For individual sync: send periodic position updates with journey ID
            // so admin panel can track each user's progress
            if (_sessionType == "individual" && !string.IsNullOrEmpty(_currentJourneyId))
            {
                positionUpdateTimer += Time.deltaTime;
                if (positionUpdateTimer >= positionUpdateInterval)
                {
                    SendPositionUpdate();
                    positionUpdateTimer = 0f;
                }
            }
        }

        heartbeatTimer += Time.deltaTime;
        if (heartbeatTimer >= heartbeatInterval)
        {
            SendHeartbeat();
            heartbeatTimer = 0f;
        }
    }

    void OnDestroy() => DisconnectFromBackend();
    void OnApplicationQuit() => DisconnectFromBackend();

    #endregion

    #region Connection

    // Call this when playback starts
    public void StartSync()
    {
        if (syncCoroutine != null)
            StopCoroutine(syncCoroutine);

        isPlaying = true;
        _isPlaying = true;
        SendStatus(); // Send status immediately on state change
        syncCoroutine = StartCoroutine(SyncLoop());
    }

    // Call this when playback stops or ends
    public void StopSync()
    {
        isPlaying = false;
        _isPlaying = false;
        SendStatus(); // Send status immediately on state change
        if (syncCoroutine != null)
        {
            StopCoroutine(syncCoroutine);
            syncCoroutine = null;
        }
    }

    private IEnumerator SyncLoop()
    {
        while (isPlaying)
        {
            SendPositionUpdate();
            yield return new WaitForSeconds(2f); // send every 2 seconds
        }
    }

    public void SetPlaying(bool value)
    {
        _isPlaying = value;
        isPlaying = value;
        SendStatus();
    }

    public void SetSessionType(string value)
    {
        _sessionType = value;
    }

    public async void ConnectToBackend()
    {
        if (_isConnected)
        {
            Debug.LogWarning("[Device] Already connected");
            return;
        }

        Debug.Log($"[Device] Connecting to {backendUrl}...");
        try
        {
            Uri uri = new Uri(backendUrl);
            socket = new SocketIOUnity(uri, new SocketIOOptions
            {
                Transport = TransportProtocol.WebSocket,
                Reconnection = true,
                ReconnectionDelay = 1000,
                ReconnectionAttempts = 5
            });
            socket.OnConnected += OnSocketConnected;
            socket.OnDisconnected += OnSocketDisconnected;
            socket.OnError += OnSocketError;

            // ✅ Listen for MQTT messages (commands from admin)
            socket.On("mqtt_message", OnMqttMessageReceived);

            // ✅ Listen for session join notifications
            socket.On("session:joined", OnSessionJoinedMessage);

            // ✅ Universal handler to catch session ID from any event
            socket.OnAny((eventName, response) =>
            {
                HandleOnAny(eventName, response);
            });

            await socket.ConnectAsync();
        }
        catch (Exception ex)
        {
            Debug.LogError($"[Device] Connection failed: {ex.Message}");
        }
    }

    private void HandleOnAny(string eventName, SocketIOResponse response)
    {
        JToken rawData = null;
        name = eventName;
        string jsonString = null;

        try
        {
            object element = response.GetValue();
            if (element == null) return;

            if (element is string s) jsonString = s;
            else jsonString = element.ToString();

            _response = jsonString;

            if (string.IsNullOrEmpty(jsonString)) return;

            if (jsonString.StartsWith("[") && jsonString.EndsWith("]"))
            {
                try
                {
                    JArray array = JArray.Parse(jsonString);
                    if (array.Count > 0) rawData = array[0];
                }
                catch (JsonReaderException)
                {
                    rawData = JToken.Parse(jsonString);
                }
            }
            else
            {
                rawData = JToken.Parse(jsonString);
            }

            if (rawData == null || rawData.Type != JTokenType.Object) return;

            string sessionId = null;
            if (rawData["payload"] is JObject payloadObject && payloadObject["sessionId"] != null)
            {
                sessionId = payloadObject["sessionId"].ToString();
            }
            else if (rawData["sessionId"] != null)
            {
                sessionId = rawData["sessionId"].ToString();
            }

            if (!string.IsNullOrEmpty(sessionId))
            {
                dispatcher.Enqueue(() =>
                {
                    if (_currentSessionId != sessionId)
                    {
                        _currentSessionId = sessionId;
                        Debug.Log($"✅ Auto-set Session ID: {_currentSessionId}");
                        SubscribeToSessionCommands(sessionId);
                        PlayerPrefs.SetString(STORAGE_KEY, sessionId);
                        PlayerPrefs.Save();
                        OnSessionJoined?.Invoke(sessionId);
                    }
                });
            }
        }
        catch (Exception ex)
        {
            Debug.LogError($"Error processing JSON in OnAny: {ex.Message}");
        }
    }

    public async void DisconnectFromBackend()
    {
        if (socket != null && _isConnected)
        {
            Debug.Log("[Device] Disconnecting...");
            await socket.DisconnectAsync();
        }
    }

    private void OnSocketConnected(object sender, EventArgs e)
    {
        _isConnected = true;
        Debug.Log("[Device] ✅ Connected to backend");

        // 1. Identify immediately
        IdentifyDevice();

        // 2. Subscribe
        SubscribeToCommands();

        // 3. Announce, Status, and Heartbeat
        AnnounceDevice();
        SendStatus();
        SendHeartbeat();

        OnConnected?.Invoke();
    }

    private void OnSocketDisconnected(object sender, string reason)
    {
        _isConnected = false;
        Debug.Log($"[Device] ❌ Disconnected: {reason}");
        OnDisconnected?.Invoke();
    }

    private void OnSocketError(object sender, string error)
    {
        Debug.LogError($"[Device] Socket error: {error}");
    }

    #endregion

    #region Identification & Discovery

    private void IdentifyDevice()
    {
        JObject payload = new JObject
        {
            { "deviceId", deviceId },
            { "type", DeviceTypeString },
            { "name", deviceName }
        };

        // Use Emit instead of EmitAsync for fire-and-forget
        socket.Emit("device:identify", payload);
        Debug.Log($"[Device] 🆔 Identified: {deviceId} ({DeviceTypeString})");
    }

    private void AnnounceDevice()
    {
        JObject payload = new JObject
        {
            { "deviceId", deviceId },
            { "type", DeviceTypeString },
            { "name", deviceName },
            { "metadata", new JObject() },
            { "timestamp", GetCurrentTimestamp() }
        };

        PublishMqtt("devices/discovery/announce", payload, false);
        Debug.Log("[Device] 📢 Device announced");
    }

    #endregion

    #region Subscriptions

    private void SubscribeToCommands()
    {
        string topic = $"devices/{deviceId}/commands/+";
        SubscribeToTopic(topic);
        Debug.Log($"[Device] 📥 Subscribed to: {topic}");

        SubscribeToTopic("devices/discovery/scan");
        Debug.Log("[Device] 📥 Subscribed to: devices/discovery/scan");
    }

    private void SubscribeToSessionCommands(string sessionId)
    {
        string topic = $"sessions/{sessionId}/commands/+";
        SubscribeToTopic(topic);
        Debug.Log($"[Device] 📥 Subscribed to session: {topic}");
    }

    private void SubscribeToTopic(string topic)
    {
        if (!_isConnected) return;

        JObject optionsPayload = new JObject { { "qos", 1 } };
        JObject subscribePayload = new JObject
        {
            { "topic", topic },
            { "options", optionsPayload }
        };

        // Use Emit instead of EmitAsync
        socket.Emit("mqtt_subscribe", subscribePayload);
    }

    #endregion

    #region Publishing

    private void PublishMqtt(string topic, object payload, bool retain = false)
    {
        if (!_isConnected) return;

        string json;
        if (payload is JToken jToken)
        {
            json = jToken.ToString(Formatting.None);
        }
        else
        {
            json = JsonConvert.SerializeObject(payload, Formatting.None);
        }

        JObject outerPayload = new JObject
        {
            { "topic", topic },
            { "payload", json },
            {
                "options", new JObject
                {
                    { "qos", 1 },
                    { "retain", retain }
                }
            }
        };

        // Use Emit instead of EmitAsync
        socket.Emit("mqtt_publish", outerPayload);
    }

    #endregion

    #region Status & Heartbeat

    public void SendStatus()
    {
        if (!_isConnected) return;

        // Status logic matches HTML: active if playing, idle otherwise
        string status = _isPlaying ? "active" : "idle";

        JObject payload = new JObject
        {
            { "deviceId", deviceId },
            { "type", DeviceTypeString },
            { "status", status },
            { "positionMs", Mathf.FloorToInt(_currentPositionMs) },
            { "sessionId", _currentSessionId ?? "" },
            { "currentJourneyId", _currentJourneyId ?? "" },
            { "timestamp", GetCurrentTimestamp() }
        };

        // 1. Socket.IO status event
        socket.Emit("device:status", payload);

        // 2. Publish Mqtt status topic (retained)
        PublishMqtt($"devices/{deviceId}/status", payload, true);

        Debug.Log($"[Device] Status sent: {status} @ {payload["positionMs"]}ms");
    }

    private void SendHeartbeat()
    {
        if (!_isConnected) return;

        string status = _isPlaying ? "active" : "idle";

        JObject payload = new JObject
        {
            { "deviceId", deviceId },
            { "type", DeviceTypeString },
            { "timestamp", GetCurrentTimestamp() },
            { "status", status }
        };

        // 1. Socket.IO heartbeat event
        socket.Emit("device:heartbeat", payload);

        // 2. Publish Mqtt heartbeat topic (not retained)
        PublishMqtt($"devices/{deviceId}/heartbeat", payload, false);

        // Debug.Log("[Device] 💓 Heartbeat sent");
    }

    private void SendPositionUpdate()
    {
        if (!_isConnected) return;

        var payload = new
        {
            deviceId,
            type = DeviceTypeString,
            @event = "timeupdate",
            positionMs = Mathf.FloorToInt(_currentPositionMs),
            sessionId = _currentSessionId,
            journeyId = _currentJourneyId,
            timestamp = GetCurrentTimestamp()
        };

        PublishMqtt($"devices/{deviceId}/events", payload, false);
    }

    #endregion

    #region Session Management

    public void JoinSession(string sessionId, string sessionType = "group", string participantId = "")
    {
        if (string.IsNullOrEmpty(sessionId))
        {
            Debug.LogError("[Device] Session ID is empty");
            return;
        }

        _currentSessionId = sessionId;
        _sessionType = string.IsNullOrEmpty(sessionType) ? "group" : sessionType;
        _participantId = participantId ?? "";

        if (!_activeSessions.Contains(sessionId))
        {
            _activeSessions.Add(sessionId);
        }

        SubscribeToSessionCommands(sessionId);

        if (_sessionType == "individual" && !string.IsNullOrEmpty(_participantId))
        {
            string participantTopic = $"sessions/{sessionId}/participants/{_participantId}/commands/+";
            SubscribeToTopic(participantTopic);
        }

        PlayerPrefs.SetString(STORAGE_KEY, sessionId);
        PlayerPrefs.Save();

        SendStatus();
        Debug.Log($"[Device] 🔗 Joined session: {sessionId}");

        OnSessionJoined?.Invoke(sessionId);
        OnSessionTypeReceived?.Invoke(_sessionType);
    }

    public void LeaveSession()
    {
        string oldSessionId = _currentSessionId;
        _currentSessionId = "";

        PlayerPrefs.DeleteKey(STORAGE_KEY);
        PlayerPrefs.Save();

        SendStatus();
        Debug.Log($"[Device] 🔓 Left session: {oldSessionId}");
        OnSessionLeft?.Invoke();
    }

    private void RestoreSession()
    {
        if (PlayerPrefs.HasKey(STORAGE_KEY))
        {
            string saved = PlayerPrefs.GetString(STORAGE_KEY);
            if (!string.IsNullOrEmpty(saved))
            {
                JoinSession(saved);
            }
        }
    }

    #endregion

    #region Receiving Commands

    private void OnMqttMessageReceived(SocketIOResponse response)
    {
        try
        {
            var element = response.GetValue(0);
            if (element == null) return;

            string jsonString = element.ToString();
            // Debug.Log($"[Device] 📨 Raw MQTT message: {jsonString}");

            using (JsonDocument doc = JsonDocument.Parse(jsonString))
            {
                JsonElement root = doc.RootElement;
                if (!root.TryGetProperty("topic", out JsonElement topicElement)) return;

                string topic = topicElement.GetString();
                string payloadStr = "{}";

                if (root.TryGetProperty("payload", out JsonElement payloadElement))
                {
                    if (payloadElement.ValueKind == JsonValueKind.String)
                        payloadStr = payloadElement.GetString();
                    else if (payloadElement.ValueKind == JsonValueKind.Object)
                        payloadStr = payloadElement.GetRawText();
                }

                if (string.IsNullOrEmpty(topic)) return;

                dispatcher.Enqueue(() =>
                {
                    HandleIncomingTopic(topic, payloadStr);
                });
            }
        }
        catch (Exception ex)
        {
            Debug.LogError($"[Device] Message parse error: {ex.Message}");
        }
    }

    private void HandleIncomingTopic(string topic, string payloadJson)
    {
        if (topic == "devices/discovery/scan")
        {
            AnnounceDevice();
            return;
        }

        string deviceCmdPrefix = $"devices/{deviceId}/commands/";
        if (topic.StartsWith(deviceCmdPrefix))
        {
            string command = topic.Substring(deviceCmdPrefix.Length);
            HandleCommand(command, payloadJson);
            return;
        }

        if (!string.IsNullOrEmpty(_currentSessionId) && !string.IsNullOrEmpty(_participantId))
        {
            string participantCmdPrefix = $"sessions/{_currentSessionId}/participants/{_participantId}/commands/";
            if (topic.StartsWith(participantCmdPrefix))
            {
                string command = topic.Substring(participantCmdPrefix.Length);
                HandleCommand(command, payloadJson);
                return;
            }
        }

        foreach (string sessionId in _activeSessions)
        {
            string sessionCmdPrefix = $"sessions/{sessionId}/commands/";
            if (topic.StartsWith(sessionCmdPrefix))
            {
                string command = topic.Substring(sessionCmdPrefix.Length);
                HandleCommand(command, payloadJson);
                return;
            }
        }
    }

    private void OnSessionJoinedMessage(SocketIOResponse response)
    {
        // Handle direct session joined event if needed
    }

    private void HandleCommand(string command, string payloadJson)
    {
        Debug.Log($"[Device] ⚙️ Command: {command}");

        switch (command)
        {
            case "play":
                _isPlaying = true;
                isPlaying = true;
                OnPlayCommand?.Invoke();
                SendStatus();
                break;
            case "pause":
                _isPlaying = false;
                isPlaying = false;
                OnPauseCommand?.Invoke();
                SendStatus();
                break;
            case "stop":
                _isPlaying = false;
                isPlaying = false;
                _currentPositionMs = 0;
                OnStopCommand?.Invoke();
                SendStatus();
                break;
            case "calibrate":
                OnCalibrateCommand?.Invoke();
                break;
            case "seek":
                try
                {
                    JObject data = JObject.Parse(payloadJson);
                    if (data["positionMs"] != null)
                    {
                        float pos = data["positionMs"].Value<float>();
                        _currentPositionMs = pos;
                        OnSeekCommand?.Invoke(pos);
                        SendStatus();
                    }
                }
                catch { }
                break;
            case "load_journey":
                try
                {
                    JObject data = JObject.Parse(payloadJson);
                    if (data["journeyId"] != null)
                    {
                        string jId = data["journeyId"].ToString();
                        _currentJourneyId = jId;
                        OnJourneySelected?.Invoke(jId);
                        SendStatus();
                    }
                }
                catch { }
                break;
        }
    }

    #endregion

    #region Helpers

    private string GetCurrentTimestamp()
    {
        return DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
    }

    #endregion
}

public enum MqttDeviceType
{
    VR,
    Chair
}