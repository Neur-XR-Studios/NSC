// VR-CHAIR SYNC ENHANCEMENT - Add these functions to mqtt-vr-device.html and mqtt-chair-device.html

// ======================
// PEER MONITORING FUNCTIONS
// ======================

// Monitor peer device (call this when joining session)
function monitorPeerDevice(peerId) {
    if (!peerId) return;
    state.peerDeviceId = peerId;
    // Subscribe to peer's status and heartbeat
    sub(`devices/${peerId}/status`);
    sub(`devices/${peerId}/heartbeat`);
    log(`Monitoring peer device: ${peerId}`);
    setK("s_peer", peerId);
}

// Update sync offset and health
function updateSyncStatus(peerPositionMs) {
    state.peerPositionMs = peerPositionMs;
    state.syncOffset = state.positionMs - peerPositionMs;

    // Determine sync health
    const absOffset = Math.abs(state.syncOffset);
    if (absOffset < 50) {
        state.syncHealth = "good";
    } else if (absOffset < 100) {
        state.syncHealth = "warning";
    } else {
        state.syncHealth = "critical";
    }

    // Update UI
    updateSyncUI();

    // Auto re-sync if critical
    if (state.syncHealth === "critical" && state.playing) {
        log(`⚠️ Sync drift critical (${state.syncOffset}ms), auto re-syncing...`);
        autoResync();
    }
}

// Update sync UI elements
function updateSyncUI() {
    const offsetEl = document.getElementById("s_sync_offset");
    const healthEl = document.getElementById("s_sync_health");

    if (offsetEl) {
        const sign = state.syncOffset >= 0 ? "+" : "";
        offsetEl.textContent = `${sign}${state.syncOffset}ms`;

        // Color code based on health
        if (state.syncHealth === "good") {
            offsetEl.style.color = "#10b981";
        } else if (state.syncHealth === "warning") {
            offsetEl.style.color = "#f59e0b";
        } else {
            offsetEl.style.color = "#ef4444";
        }
    }

    if (healthEl) {
        const healthIcons = {
            good: "🟢",
            warning: "🟡",
            critical: "🔴",
            unknown: "⚪"
        };
        healthEl.textContent = healthIcons[state.syncHealth] || "⚪";
    }
}

// Update peer status
function updatePeerStatus(status, timestamp) {
    state.peerStatus = status;
    state.peerLastSeen = timestamp || Date.now();

    const peerStatusEl = document.getElementById("s_peer_status");
    if (peerStatusEl) {
        if (status === "active" || status === "idle") {
            peerStatusEl.textContent = "🟢 Connected";
            peerStatusEl.style.color = "#10b981";
        } else {
            peerStatusEl.textContent = "🔴 Disconnected";
            peerStatusEl.style.color = "#ef4444";
        }
    }
}

// Check peer heartbeat timeout
function checkPeerTimeout() {
    if (!state.peerLastSeen) return;

    const now = Date.now();
    const timeSinceLastSeen = now - state.peerLastSeen;

    // If no heartbeat for 5 seconds, mark as disconnected
    if (timeSinceLastSeen > 5000 && state.peerStatus !== "disconnected") {
        state.peerStatus = "disconnected";
        updatePeerStatus("disconnected");
        log(`⚠️ Peer device timeout - no heartbeat for ${Math.floor(timeSinceLastSeen / 1000)}s`);
    }
}

// ======================
// SYNC RECOVERY FUNCTIONS
// ======================

// Force re-sync (manual or automatic)
function forceResync() {
    log(`🔄 Force re-sync initiated at position ${state.positionMs}ms`);

    // Send sync request to peer
    sendEvent('request_sync', {
        positionMs: state.positionMs,
        timestamp: Date.now(),
        journeyId: state.journeyId
    });

    // Also broadcast sync command to session
    if (state.sessionId) {
        const syncPayload = {
            command: "sync",
            positionMs: state.positionMs,
            journeyId: state.journeyId,
            timestamp: Date.now(),
            sourceDevice: state.id
        };
        pub(`sessions/${state.sessionId}/commands/sync`, JSON.stringify(syncPayload), false);
    }
}

// Auto re-sync when drift is too large
function autoResync() {
    if (!state.playing) return; // Only auto-sync during playback

    log(`🔄 Auto re-sync triggered (offset: ${state.syncOffset}ms)`);

    // For VR: keep our position, send to chair
    // For Chair: adjust to VR's position
    if (state.type === "vr") {
        forceResync();
    } else if (state.type === "chair") {
        // Chair should sync to VR's position
        if (state.peerPositionMs > 0) {
            state.positionMs = state.peerPositionMs;
            updateMotionFromTelemetry(state.positionMs);
            log(`✓ Synced to VR position: ${state.positionMs}ms`);
        }
    }
}

// Handle incoming sync request
function handleSyncRequest(data) {
    const requestedPosition = data.positionMs || 0;
    const sourceDevice = data.sourceDevice || "";

    log(`📥 Sync request from ${sourceDevice}: ${requestedPosition}ms`);

    // If we're the chair, sync to the requested position
    if (state.type === "chair") {
        state.positionMs = requestedPosition;
        updateMotionFromTelemetry(requestedPosition);
        log(`✓ Synced to requested position: ${requestedPosition}ms`);
    }

    // If we're VR, acknowledge but keep our position (VR is the source of truth)
    if (state.type === "vr" && player && player.src) {
        const currentVideoPos = Math.floor((player.currentTime || 0) * 1000);
        if (Math.abs(currentVideoPos - requestedPosition) > 100) {
            log(`⚠️ Sync request position differs from video (${currentVideoPos}ms vs ${requestedPosition}ms)`);
        }
    }
}

// ======================
// ENHANCED MESSAGE HANDLING
// ======================

// Add to existing onMsg function - handle peer status messages
function handlePeerMessage(topic, payload) {
    try {
        const data = JSON.parse(payload);

        // Check if this is from our peer device
        if (topic.includes(`devices/${state.peerDeviceId}/status`)) {
            updatePeerStatus(data.status, Date.now());
            if (typeof data.positionMs === "number") {
                updateSyncStatus(data.positionMs);
            }
        }

        if (topic.includes(`devices/${state.peerDeviceId}/heartbeat`)) {
            updatePeerStatus(data.status || "active", Date.now());
        }

        // Handle sync commands
        if (topic.includes("/commands/sync")) {
            handleSyncRequest(data);
        }
    } catch (e) {
        // Ignore parse errors for non-JSON messages
    }
}

// ======================
// UI ADDITIONS
// ======================

/*
Add these to the Device Info section in HTML:

<div class="info-item">
  <div class="info-label">Peer Status</div>
  <div class="info-value" id="s_peer_status">⚪ Unknown</div>
</div>
<div class="info-item">
  <div class="info-label">Sync Offset</div>
  <div class="info-value" id="s_sync_offset">0ms</div>
</div>
<div class="info-item">
  <div class="info-label">Sync Health</div>
  <div class="info-value" id="s_sync_health">⚪</div>
</div>

Add this button to Session Management section:

<button class="btn-primary" onclick="forceResync()">🔄 Re-sync</button>
*/

// ======================
// INTEGRATION INSTRUCTIONS
// ======================

/*
1. Add the state variables (already done in previous edit)

2. In connectBroker(), after subscribing to device commands, add:
   // Start peer timeout checker
   setInterval(checkPeerTimeout, 2000);

3. In onMsg(), add call to handlePeerMessage:
   handlePeerMessage(t, p);

4. In joinSession(), add peer monitoring:
   // Determine peer device ID (for now, manually set or detect from session)
   // In a real implementation, you'd get this from the session participants
   const peerType = state.type === "vr" ? "chair" : "vr";
   // You'll need to implement logic to find the peer device ID from session
   // For testing, you can manually set it:
   // monitorPeerDevice("CHAIR_001"); // or "VR_001"

5. In handleCmd(), add sync command handling:
   if (cmd === "sync" || cmd === "request_sync") {
     handleSyncRequest(data);
   }

6. In startTicker(), add sync monitoring:
   // Check peer timeout every tick
   checkPeerTimeout();
*/
