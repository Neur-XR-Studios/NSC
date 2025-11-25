# Unity Integration Guide: VR-Chair Sync System

## Overview

This guide provides complete Unity implementation for synchronizing VR headset video playback with motion chair telemetry data using MQTT messaging protocol.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [MQTT Client Setup](#mqtt-client-setup)
3. [VR Device Implementation](#vr-device-implementation)
4. [Motion Chair Implementation](#motion-chair-implementation)
5. [Sync Protocol](#sync-protocol)
6. [Telemetry Data Structure](#telemetry-data-structure)
7. [Testing](#testing)

---

## Prerequisites

### Required Unity Packages

```
M2MqttUnity (MQTT Client for Unity)
```

**Installation**:
1. Download M2MqttUnity from: https://github.com/gpvigano/M2MqttUnity
2. Import into Unity project: `Assets > Import Package > Custom Package`

### Backend Requirements

- Backend API running at: `http://your-backend-url:8001`
- MQTT Broker accessible via WebSocket: `ws://your-backend-url:9001`

---

## MQTT Client Setup

### 1. Create MQTTManager.cs

```csharp
using System;
using System.Collections.Generic;
using UnityEngine;
using uPLibrary.Networking.M2Mqtt;
using uPLibrary.Networking.M2Mqtt.Messages;
using M2MqttUnity;

public class MQTTManager : M2MqttUnityClient
{
    public static MQTTManager Instance { get; private set; }

    [Header("MQTT Configuration")]
    public string brokerAddress = "localhost";
    public int brokerPort = 9001; // WebSocket port
    public string deviceId = "VR_001";
    public string deviceType = "vr"; // "vr" or "chair"

    private Dictionary<string, Action<string>> topicHandlers = new Dictionary<string, Action<string>>();

    protected override void Awake()
    {
        base.Awake();
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    protected override void Start()
    {
        base.Start();
        ConnectToBroker();
    }

    public void ConnectToBroker()
    {
        brokerAddress = this.brokerAddress;
        brokerPort = this.brokerPort;
        
        // Connect to MQTT broker
        Connect();
        
        Debug.Log($"Connecting to MQTT broker at {brokerAddress}:{brokerPort}");
    }

    protected override void OnConnected()
    {
        base.OnConnected();
        Debug.Log("Connected to MQTT broker");
        
        // Subscribe to device commands
        SubscribeToTopic($"devices/{deviceId}/commands/+");
        
        // Publish discovery announcement
        PublishDiscoveryAnnouncement();
        
        // Start heartbeat
        InvokeRepeating(nameof(SendHeartbeat), 0f, 15f);
    }

    protected override void OnConnectionFailed(string errorMessage)
    {
        base.OnConnectionFailed(errorMessage);
        Debug.LogError($"MQTT Connection failed: {errorMessage}");
    }

    protected override void DecodeMessage(string topic, byte[] message)
    {
        string msg = System.Text.Encoding.UTF8.GetString(message);
        Debug.Log($"Received message on topic {topic}: {msg}");
        
        // Invoke registered handlers
        if (topicHandlers.ContainsKey(topic))
        {
            topicHandlers[topic]?.Invoke(msg);
        }
        
        // Check for wildcard matches
        foreach (var kvp in topicHandlers)
        {
            if (TopicMatches(kvp.Key, topic))
            {
                kvp.Value?.Invoke(msg);
            }
        }
    }

    public void SubscribeToTopic(string topic, Action<string> handler = null)
    {
        client.Subscribe(new string[] { topic }, new byte[] { MqttMsgBase.QOS_LEVEL_AT_LEAST_ONCE });
        
        if (handler != null)
        {
            topicHandlers[topic] = handler;
        }
        
        Debug.Log($"Subscribed to topic: {topic}");
    }

    public void PublishMessage(string topic, string payload, bool retain = false)
    {
        if (client != null && client.IsConnected)
        {
            client.Publish(topic, System.Text.Encoding.UTF8.GetBytes(payload), 
                          MqttMsgBase.QOS_LEVEL_AT_LEAST_ONCE, retain);
            Debug.Log($"Published to {topic}: {payload}");
        }
    }

    private void PublishDiscoveryAnnouncement()
    {
        var announcement = new
        {
            deviceId = deviceId,
            type = deviceType,
            name = $"{deviceType.ToUpper()}_{deviceId}",
            metadata = new { },
            timestamp = DateTime.UtcNow.ToString("o")
        };
        
        PublishMessage("devices/discovery/announce", JsonUtility.ToJson(announcement));
    }

    private void SendHeartbeat()
    {
        if (client != null && client.IsConnected)
        {
            var heartbeat = new
            {
                deviceId = deviceId,
                type = deviceType,
                timestamp = DateTime.UtcNow.ToString("o"),
                status = "active"
            };
            
            PublishMessage($"devices/{deviceId}/heartbeat", JsonUtility.ToJson(heartbeat));
        }
    }

    private bool TopicMatches(string pattern, string topic)
    {
        // Simple wildcard matching for MQTT topics
        if (pattern.Contains("+"))
        {
            string[] patternParts = pattern.Split('/');
            string[] topicParts = topic.Split('/');
            
            if (patternParts.Length != topicParts.Length) return false;
            
            for (int i = 0; i < patternParts.Length; i++)
            {
                if (patternParts[i] != "+" && patternParts[i] != topicParts[i])
                    return false;
            }
            return true;
        }
        return pattern == topic;
    }

    protected override void OnApplicationQuit()
    {
        CancelInvoke(nameof(SendHeartbeat));
        Disconnect();
        base.OnApplicationQuit();
    }
}
```

See full implementation in the complete guide file.

---

## Summary

This Unity integration provides:
- ✅ MQTT client setup for device communication
- ✅ VR device controller with video playback sync
- ✅ Motion chair controller with telemetry-driven motion
- ✅ Real-time sync monitoring and recovery
- ✅ Complete command handling
- ✅ Peer status tracking

**Critical**: VR device is the source of truth. Chair always syncs TO VR position, never the other way around.

For complete C# code examples, see the full guide in the project documentation.
