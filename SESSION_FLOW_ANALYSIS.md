# NSC IndividualSession & GroupSession Flow Analysis

## Overview
The NSC (Neur-XR-Studios) project implements a sophisticated session management system that supports both **IndividualSession** and **GroupSession** workflows for controlling VR and chair devices in synchronized experiences. This document provides a comprehensive analysis of both flows.

---

## Architecture Overview

### Key Components

#### Backend
- **SessionController.js** - REST API endpoints for session management
- **SessionService.js** - Business logic for session creation, command execution, and participant management
- **Session.js** - Database model storing session metadata
- **SessionParticipant.js** - Database model for mapping VR+Chair pairs within sessions
- **SessionRoute.js** - Express routes for session endpoints

#### Frontend
- **DeviceControlPanel.tsx** - Main orchestrator component
- **SessionTypeStep.tsx** - Step 1: Choose session type (Individual vs Group)
- **DeviceSelectionStep.tsx** - Step 2: Select device pairs
- **JourneySelectionStep.tsx** - Step 3: Select journeys to play
- **IndividualSessionController.tsx** - Step 4: Individual session playback control
- **GroupSessionController.tsx** - Step 4: Group session playback control
- **sessions.ts** - API client library for session operations

#### Communication
- **MQTT** - Real-time device commands and telemetry
- **Socket.IO** - Browser client updates and Bridge fallback
- **REST API** - Session creation, retrieval, and updates

---

## Session Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVICE CONTROL PANEL                         │
│                   DeviceControlPanel.tsx                         │
│  (Main orchestrator managing state and navigation)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Step 1:      │ │ Step 2:      │ │ Step 3:      │
        │ SessionType  │ │ DeviceSelect │ │ JourneySelect│
        │ (Individual/ │ │ (Pick pairs) │ │ (Pick content)
        │ Group)       │ │              │ │              │
        └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
               │                 │                │
               └─────────────────┼────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │ Individual Session   │  │ Group Session        │
        │ IndividualSession    │  │ GroupSessionCtrl.tsx │
        │ Controller.tsx       │  │                      │
        │ Per-participant      │  │ Shared playback      │
        │ journey control      │  │ for all             │
        └──────────────────────┘  └──────────────────────┘
```

---

## Detailed Flow Analysis

### DATABASE MODELS

#### Session Model
```javascript
{
  id: UUID (primaryKey),
  vr_device_id: STRING (optional, for backward compatibility),
  chair_device_id: STRING (optional, for backward compatibility),
  status: ENUM('pending', 'ready', 'running', 'paused', 'stopped', 'completed'),
  overall_status: ENUM('on_going', 'completed'),
  group_id: STRING (for group sessions),
  journey_ids: JSON (array of journey IDs to play),
  session_type: ENUM('individual', 'group'),
  start_time_ms: BIGINT,
  last_position_ms: BIGINT (last playback position),
  last_command: STRING ('start', 'pause', 'seek', 'stop', 'select_journey'),
  total_duration_ms: BIGINT,
  pause_duration_ms: BIGINT,
  started_at: DATE,
  paused_at: DATE,
  stopped_at: DATE,
  ... (timestamps)
}
```

#### SessionParticipant Model
```javascript
{
  id: UUID (primaryKey),
  session_id: UUID (foreign key to Session),
  vr_device_id: STRING,
  chair_device_id: STRING,
  participant_code: STRING (6-char code),
  language: STRING (optional),
  current_journey_id: INTEGER,
  joined_at: DATE,
  left_at: DATE,
  sync_ok_rate: DECIMAL,
  avg_drift_ms: INTEGER,
  max_drift_ms: INTEGER,
  status: ENUM('active', 'left', 'completed'),
  ... (timestamps)
}
```

---

## INDIVIDUAL SESSION FLOW

### 1. Session Creation (Individual)

**Endpoint:** `POST /sessions`

**Request:**
```typescript
{
  session_type: "individual",
  vrDeviceId: string,        // deviceId of VR device
  chairDeviceId: string,     // deviceId of Chair device
  journeyId?: number[],      // Optional - selected journeys (empty initially)
  videoId?: string           // Optional fallback
}
```

**Backend Flow (SessionService.startSession):**
```
1. Validate inputs
   - Check vrDeviceId and chairDeviceId exist
   - Check requested journeys exist

2. Look up VR and Chair devices
   - Try by primary key first
   - Fall back to deviceId field

3. Create Session record
   - session_type = "individual"
   - status = "ready"
   - journey_ids = null (operator selects later)
   - vr_device_id, chair_device_id stored for compatibility

4. Create initial SessionParticipant
   - Maps the VR + Chair pair
   - status = "active"
   - language = null
   - current_journey_id = null

5. Return session with participant ID
```

**Response:**
```typescript
{
  status: true,
  data: {
    id: "session-uuid",
    session_type: "individual",
    status: "ready",
    vr_device_id: "vr-hw-id",
    chair_device_id: "chair-hw-id",
    journey_ids: null,
    participants: [
      {
        id: "participant-uuid",
        session_id: "session-uuid",
        vr_device_id: "vr-hw-id",
        chair_device_id: "chair-hw-id",
        status: "active"
      }
    ]
  }
}
```

### 2. Individual Session UI State Management

**IndividualSessionController Component:**

```typescript
// Per-session pairs tracking
const sessionPairs = useMemo(
  () => activePair 
    ? pairs.filter((p) => p.sessionId === activePair.sessionId)
    : [],
  [activePair, pairs]
);

// Per-participant state
const [participantIdByPair, setParticipantIdByPair] = useState<Record<string, string>>({});
const [selectedJourneyByPair, setSelectedJourneyByPair] = useState<Record<string, number>>({});
const [audioSel, setAudioSel] = useState<Record<string, string>>({});

// Load participant mapping from backend
useEffect(() => {
  const load = async () => {
    const res = await getSessionById(sessionId);
    const participants = res?.data?.participants || [];
    
    participants.forEach((p) => {
      const key = `${p.vr_device_id}-${p.chair_device_id}`;
      participantIdByPair[key] = p.id;                    // Store participant ID
      selectedJourneyByPair[key] = p.current_journey_id;  // Load journey
      audioSel[key] = p.language;                         // Load language
    });
  };
}, [sessionId]);
```

### 3. Individual Session Controls

**Adding a Participant (Dynamic Pairing):**

**Endpoint:** `POST /sessions/{sessionId}/participants`

```typescript
{
  vrDeviceId: string,
  chairDeviceId: string,
  language?: string
}
```

**Backend Flow:**
```
1. Find or create new participant
2. Send join_session MQTT to devices
   - For individual: journeyId = null (operator selects later)
3. Return participant record
```

**MQTT Topics Used:**
- `devices/{vrHwId}/commands/join_session` - Notify VR device
- `devices/{chairHwId}/commands/join_session` - Notify chair device

### 4. Individual Session Playback Commands

**Participant Commands (Per-individual playback control):**

```typescript
// Select journey for this participant
await commandParticipant(sessionId, participantId, "select_journey", {
  journeyId: 123,
  language: "en"
});

// Play command
await commandParticipant(sessionId, participantId, "play", {
  positionMs: 0
});

// Pause command
await commandParticipant(sessionId, participantId, "pause", {
  positionMs: 15000
});

// Seek command
await commandParticipant(sessionId, participantId, "seek", {
  positionMs: 30000
});

// Stop command
await commandParticipant(sessionId, participantId, "stop");
```

**MQTT Command Topics:**
```
sessions/{sessionId}/participants/{participantId}/commands/{cmd}
devices/{vrHwId}/commands/{cmd}
devices/{chairHwId}/commands/{cmd}
```

**Command Payload Examples:**

```javascript
// select_journey
{
  cmd: "select_journey",
  journeyId: 123,
  language: "en",
  applyAtMs: Date.now() + 1500  // Small sync buffer
}

// play
{
  cmd: "start",
  startAtMs: Date.now() + 1500,
  durationMs: 300000
}

// pause
{
  cmd: "pause",
  positionMs: 15000
}

// seek
{
  cmd: "seek",
  positionMs: 30000,
  applyAtMs: Date.now() + 1500
}
```

### 5. Individual Session Data Sync

**Device Status Updates (Real-time):**

Devices publish playback position and status to:
```
devices/{vrHwId}/telemetry/position
devices/{chairHwId}/telemetry/position
```

Frontend updates state via Socket.IO:
```typescript
// deviceInfoById tracks real-time device state
const deviceInfoById = {
  [vrId]: {
    status: "active" | "idle" | "error",
    currentJourneyId: 123,
    positionMs: 15000
  },
  [chairId]: { ... }
};

// UI synchronizes based on device status
const isPlaying = vrInfoActive || chairInfoActive;
```

### 6. Individual Session UI Rendering

```typescript
// IndividualSessionController renders:
// 1. All pairs in current session (sessionPairs)
// 2. Current journey display with video player
// 3. Per-pair controls (play/pause/seek)
// 4. Per-pair journey selector
// 5. Per-pair audio language selector
// 6. Add/Remove participant buttons

// Key UI elements
<VideoPlayer
  ref={playerRefs.current[key]}  // Per-pair video ref
  videoSrc={primaryMedia.video.url}
  onPlayPauseClick={() => {
    // Send command to this specific participant
    sendParticipantCmd({vrId, chairId}, "play/pause", currentMs)
  }}
  onSeekEnd={(ms) => {
    // Send seek command to participant
    sendParticipantCmd({vrId, chairId}, "seek", ms)
  }}
/>

// Journey carousel (choose for this participant)
<JourneyCarousel
  journeys={journeys}
  onSelect={(journeyId) => {
    commandParticipant(sessionId, participantId, "select_journey", {journeyId})
  }}
/>
```

### 7. Individual Session Persistence

**When participant updates:**
```javascript
// In commandParticipant, for select_journey:
if (cmd === 'select_journey' && journeyId != null) {
  await SessionParticipant.update(
    { current_journey_id: journeyId, language: language },
    { where: { id: participantId } }
  );
}

// Session updates stored
switch (cmd) {
  case 'start':
    session.update({
      status: 'running',
      start_time_ms: nowMs + 1500,
      started_at: now
    });
    break;
  case 'pause':
    session.update({
      status: 'paused',
      last_position_ms: positionMs,
      paused_at: now
    });
    break;
  case 'stop':
    session.update({
      status: 'stopped',
      overall_status: 'completed',
      total_duration_ms: totalMs
    });
    break;
}
```

---

## GROUP SESSION FLOW

### 1. Session Creation (Group)

**Endpoint:** `POST /sessions/group`

**Request:**
```typescript
{
  members: [
    { vrDeviceId: "vr-device-1", chairDeviceId: "chair-device-1", language?: "en" },
    { vrDeviceId: "vr-device-2", chairDeviceId: "chair-device-2", language?: "es" },
    ...
  ],
  groupId?: string,           // Optional, auto-generated if not provided
  journeyId?: number,         // Single journey for all
  journeyIds?: number[],      // Multiple journeys for all
  videoId?: string
}
```

**Auto-generated Group ID Format:**
```
GRP-YYYYMMDD-NNN
Example: GRP-20250125-001
```

### 2. Backend Group Session Creation

**SessionService.createGroupSession:**

```
1. Validate inputs
   - members array not empty
   - Each member has vrDeviceId and chairDeviceId
   - journey_ids not empty

2. Validate devices exist
   - Look up each VR device
   - Look up each Chair device

3. Validate journeys exist
   - Check journey IDs in database

4. Generate group ID (if not provided)
   - Format: GRP-YYYYMMDD-NNN
   - Count existing sessions for that day
   - Increment sequence number

5. Pause existing running group sessions
   - Update any running group sessions to 'paused'
   - This ensures only one group session runs at a time

6. Create Session record
   - session_type = "group"
   - status = "ready"
   - group_id = finalGroupId
   - journey_ids = [journeys array]

7. Create all SessionParticipants (bulk)
   - One participant per VR+Chair pair
   - All share same journey_ids initially

8. Broadcast join_session to all devices
   - Topic: devices/{vrHwId}/commands/join_session
   - Topic: devices/{chairHwId}/commands/join_session
   - Payload includes: sessionId, sessionType='group', participantId, journeyId (first journey)
```

**Response:**
```typescript
{
  status: true,
  data: {
    session: {
      id: "session-uuid",
      session_type: "group",
      status: "ready",
      group_id: "GRP-20250125-001",
      journey_ids: [123, 124],
      participants: [
        {
          id: "participant-1",
          vr_device_id: "vr-1",
          chair_device_id: "chair-1",
          language: "en"
        },
        {
          id: "participant-2",
          vr_device_id: "vr-2",
          chair_device_id: "chair-2",
          language: "es"
        }
      ]
    },
    groupId: "GRP-20250125-001"
  }
}
```

### 3. Group Session UI State Management

**GroupSessionController Component:**

```typescript
// All pairs in this group session
const sessionPairs = useMemo(
  () => activePair 
    ? pairs.filter((p) => p.sessionId === activePair.sessionId)
    : [],
  [activePair, pairs]
);

// Shared journey carousel for all participants
const journeyIdsAll = activePair?.journeyId;  // All participants share these

// Single playback state for group
const [currentJourneyIdx, setCurrentJourneyIdx] = useState(0);
const [isSessionPlaying, setIsSessionPlaying] = useState(false);

// Shared audio selection
const [audioSel, setAudioSel] = useState<Record<string, string>>({});
```

**Key Difference from Individual:**
- No `selectedJourneyByPair` - journey is shared
- Single `currentJourneyIdx` - all participants follow same journey
- Group-level playback state

### 4. Group Session Commands

**Session-level Commands (Broadcast to all participants):**

```typescript
// All participants in group get same command
await commandSession(sessionId, "play", {positionMs: 0});
await commandSession(sessionId, "pause", {positionMs: 15000});
await commandSession(sessionId, "seek", {positionMs: 30000});
await commandSession(sessionId, "select_journey", {journeyId: 124});
await commandSession(sessionId, "stop");
```

**MQTT Topics:**
```
sessions/{sessionId}/commands/{cmd}
```

**Backend commandSession Flow:**

```
1. Publish to main session topic
   sessions/{sessionId}/commands/{cmd}

2. Look up all participants in session
   SessionParticipant.findAll({where: {session_id: sessionId}})

3. For each participant, publish to device topics
   devices/{vrHwId}/commands/{cmd}
   devices/{chairHwId}/commands/{cmd}

4. Mirror to Socket.IO (Bridge fallback)
   global.io?.emit('mqtt_message', {topic, payload})

5. Update session state
   session.update({
     status: 'running'|'paused'|'stopped',
     last_command: cmd,
     last_position_ms: positionMs,
     ...
   })
```

### 5. Group Session Synchronization

**Sync Challenge:**
Multiple devices (VRs and Chairs) need to stay synchronized during playback.

**Frontend Sync Handling:**
```typescript
// When any device goes offline
if (sessionOfflineDevices.length > 0) {
  // Auto-pause session
  const currentMs = playerRefs.current[key]?.getCurrentTimeMs() || 0;
  await commandSession(sessionId, "pause", {positionMs: currentMs});
  setIsSessionPlaying(false);
}

// Manual pause handling
manualPausedRef.current = true;
const currentMs = seekValues[sessionId] || playerRefs.current[key]?.getCurrentTimeMs() || 0;
await commandSession(sessionId, "pause", {positionMs: currentMs});
```

**Backend Sync Payload:**
```javascript
{
  cmd: "sync",
  serverTimeMs: Date.now(),
  journeyId: 123,
  applyAtMs: Date.now() + 1500  // Devices sync to this time
}
```

### 6. Group Session Journey Navigation

**UI Controls:**
```typescript
// Carousel to move between journeys
const currentCard = journeyCards[currentJourneyIdx];

<Button onClick={() => {
  setCurrentJourneyIdx((prev) => Math.max(0, prev - 1));
  const journeyId = journeyCards[currentJourneyIdx - 1]?.jid;
  await commandSession(sessionId, "select_journey", {journeyId});
}}>
  Previous Journey
</Button>

<Button onClick={() => {
  setCurrentJourneyIdx((prev) => Math.min(journeyCards.length - 1, prev + 1));
  const journeyId = journeyCards[currentJourneyIdx + 1]?.jid;
  await commandSession(sessionId, "select_journey", {journeyId});
}}>
  Next Journey
</Button>
```

---

## Comparison: Individual vs Group Sessions

| Aspect | Individual | Group |
|--------|-----------|-------|
| **Participants** | 1+ pairs, independent | 1+ pairs, synchronized |
| **Journey Selection** | Per-participant | Shared by all |
| **Playback Position** | Per-participant | Synchronized |
| **Audio Language** | Per-participant | Can vary per participant |
| **Commands** | `commandParticipant()` | `commandSession()` |
| **State Persistence** | Per `SessionParticipant` | Per `Session` + `SessionParticipant` |
| **MQTT Topics** | `sessions/{sid}/participants/{pid}/commands/{cmd}` | `sessions/{sid}/commands/{cmd}` |
| **Auto-pause old group** | N/A | Yes, only one group at a time |
| **Database Structure** | participants linked to session | participants linked to session |
| **UI Component** | `IndividualSessionController` | `GroupSessionController` |

---

## Frontend Workflow: DeviceControlPanel.tsx

### State Variables
```typescript
// Session workflow state
const [sessionType, setSessionType] = useState<SessionType | null>(null);
const [currentStep, setCurrentStep] = useState("session-type");

// Selected devices and journeys
const [pairs, setPairs] = useState<Pair[]>([]);
const [selectedJourneyIds, setSelectedJourneyIds] = useState<string[]>([]);
const [selectedJourneyLangs, setSelectedJourneyLangs] = useState<Record<string, string>>({});

// Active session tracking
const [activeSessionId, setActiveSessionId] = useState<string>("");
const [activePair, setActivePair] = useState<Pair | null>(null);
```

### Step-by-Step Navigation

```
Step 1: SessionTypeStep
  ↓ User selects "Individual" or "Group"
  setSessionType("individual" | "group")
  setCurrentStep("device-selection")

Step 2: DeviceSelectionStep
  ↓ User selects device pairs (must be online)
  setPairs([{vrId, chairId, sessionId: ""}, ...])
  setCurrentStep("journey-selection" | immediate creation for individual)

Step 3: JourneySelectionStep (Group only)
  ↓ User selects journeys
  setSelectedJourneyIds([journeyId1, journeyId2, ...])
  Create group session and activate

Step 4: Play Session
  ↓ User controls playback
  IndividualSessionController or GroupSessionController
  Send commands to devices
```

### Individual Session Creation
```typescript
const handleCreateIndividual = useCallback(async () => {
  const first = pairs[0];
  if (!first) return;

  try {
    const session = await createIndividualSession({
      session_type: "individual",
      vrDeviceId: first.vrId,
      chairDeviceId: first.chairId,
      journeyId: [],  // Empty initially
    });

    // Activate session for playback control
    setActiveSessionId(session.id);
    setActivePair({
      sessionId: session.id,
      vrId: first.vrId,
      chairId: first.chairId,
      journeyId: [],
    });

    setCurrentStep("playback");
  } catch (error) {
    toast({ variant: "destructive", title: "Failed to create session" });
  }
}, [pairs, toast]);
```

### Group Session Creation
```typescript
const handleCreateGroup = useCallback(async () => {
  try {
    const result = await createGroupSession({
      session_type: "group",
      members: pairs.map((p) => ({
        vrDeviceId: p.vrId,
        chairDeviceId: p.chairId,
        language: selectedJourneyLangs[p.vrId] || null,
      })),
      journeyIds: selectedJourneyIds.map(Number),
    });

    // Activate group session
    setActiveSessionId(result.session.id);
    setActivePair({
      sessionId: result.session.id,
      vrId: pairs[0].vrId,
      chairId: pairs[0].chairId,
      journeyId: selectedJourneyIds.map(Number),
    });

    setCurrentStep("playback");
  } catch (error) {
    toast({ variant: "destructive", title: "Failed to create group session" });
  }
}, [pairs, selectedJourneyIds, selectedJourneyLangs, toast]);
```

---

## API Routes

### Session Routes (`/sessions`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | List all sessions (default status: on_going) |
| GET | `/:id` | Get session details with participants |
| POST | `/` | Create individual session |
| POST | `/from-pair` | Create from device pair ID |
| POST | `/group` | Create group session |
| POST | `/group/from-pairs` | Create group from pair IDs |
| POST | `/:id/commands` | Send command to entire session |
| POST | `/:id/participants` | Add participant to session |
| DELETE | `/:id/participants/:pid` | Remove participant from session |
| POST | `/:id/participants/:pid/commands` | Send command to participant |
| PATCH | `/:id` | Update session metadata |
| PATCH | `/:id/status` | Update session overall_status |
| DELETE | `/:id` | Delete session and participants |

---

## Real-time Communication Flow

### MQTT Message Flow

```
┌─ Frontend sends command
│
├─→ API: commandSession(sessionId, cmd, options)
│    └─→ SessionService.commandAndUpdate()
│        ├─→ Publish to: sessions/{sessionId}/commands/{cmd}
│        ├─→ Publish to: devices/{vrHw}/commands/{cmd}
│        ├─→ Publish to: devices/{chairHw}/commands/{cmd}
│        ├─→ Emit Socket.IO: 'mqtt_message'
│        └─→ Update Session record
│
├─ Devices receive MQTT
│  ├─→ Process command
│  ├─→ Update playback state
│  └─→ Send telemetry
│
└─ Frontend receives updates
   ├─→ Via Socket.IO telemetry
   ├─→ Via device info polling
   └─→ Update UI state
```

### Device Telemetry Flow

```
Device (VR/Chair)
  ↓ Publishes position to devices/{hwId}/telemetry/position
  ├─ positionMs: 15000
  ├─ status: 'active'|'paused'|'stopped'
  ├─ currentJourneyId: 123
  └─ timestamp: ISO string

MQTT Broker
  ↓ Relays to backend
  ├─→ SessionService listens
  ├─→ Updates session state (optional)
  └─→ Broadcasts to frontend via Socket.IO

Frontend (React)
  ↓ Receives via Socket.IO
  ├─→ Updates deviceInfoById state
  ├─→ Re-renders video player position
  ├─→ Updates play/pause button state
  └─→ Triggers sync if out of range
```

---

## Error Handling & Edge Cases

### Individual Session Edge Cases

1. **Adding Participant with Offline Device**
   - Frontend checks `onlineById` before allowing add
   - Toast error if device offline

2. **Device Disconnects During Playback**
   - SessionController updates deviceInfoById
   - Frontend detects status change
   - UI grays out controls or shows "Offline"

3. **Participant Removes Journey**
   - `current_journey_id` set to null
   - UI needs fallback (default to first available journey)

4. **Multiple Sessions on Same Pair**
   - Only one active session per pair
   - Previous session automatically paused

### Group Session Edge Cases

1. **Auto-pause Previous Group Session**
   ```javascript
   // On group creation
   await Session.update(
     {status: 'paused'},
     {where: {session_type: 'group', status: 'running'}}
   );
   ```

2. **Participant Joins Late**
   - `addParticipant()` sends join_session
   - Device gets current first journey ID
   - Player syncs to shared playback position

3. **All Devices Offline**
   - Session remains in 'ready' state
   - Controls disabled
   - Can be resumed when device comes online

4. **Device Offline Mid-Playback**
   - Group auto-pauses
   - All devices receive pause command
   - Operator can manual resume when device comes back

---

## Session Persistence & Recovery

### Database Persistence

**Session state saved:**
```javascript
{
  status: 'ready'|'running'|'paused'|'stopped'|'completed',
  overall_status: 'on_going'|'completed',
  last_command: 'start'|'pause'|'seek'|'stop'|'select_journey',
  last_position_ms: 15000,
  started_at: ISO timestamp,
  paused_at: ISO timestamp,
  stopped_at: ISO timestamp,
  total_duration_ms: 300000,
  pause_duration_ms: 45000
}
```

**Participant state saved:**
```javascript
{
  current_journey_id: 123,
  language: 'en',
  status: 'active'|'left'|'completed',
  sync_ok_rate: 95.5,
  avg_drift_ms: 250,
  max_drift_ms: 1200
}
```

### Session Recovery (Upon Reconnect)

```typescript
// Frontend on load
useEffect(() => {
  const load = async () => {
    const res = await getSessionById(sessionId);
    const session = res.data;
    
    // Restore state
    setActivePair({
      sessionId: session.id,
      vrId: session.vr_device_id,
      chairId: session.chair_device_id,
      journeyId: session.journey_ids
    });
    
    // Resume playback if was running
    if (session.status === 'running') {
      await commandSession(sessionId, 'start', {
        positionMs: session.last_position_ms
      });
    }
  };
}, [sessionId]);
```

---

## Performance Considerations

1. **Participant Lookup**
   - Bulk query: `SessionParticipant.findAll({where: {session_id}})`
   - Indexed on `session_id` and `id`

2. **Journey Enrichment**
   - Single batch load all journey IDs
   - Cache in Map for O(1) lookup
   - Load audio tracks and videos in one query

3. **Device Status Updates**
   - Real-time via MQTT/Socket.IO
   - Frontend debounces state updates (React batching)
   - Video player uses requestAnimationFrame for smooth playback

4. **Session Commands**
   - Async MQTT publish (non-blocking)
   - Session state update in background
   - Response sent immediately

---

## Security & Validation

### Input Validation

1. **Session Creation**
   - Device IDs must exist in database
   - Journey IDs must exist
   - Participant language validated

2. **Commands**
   - Session must exist
   - Participants must exist
   - Position values within journey duration

3. **Authorization**
   - All session routes require `auth(['admin', 'user'])`
   - Prevent unauthorized session manipulation

### Data Integrity

1. **Transaction Safety** (on device registration)
   ```javascript
   await sequelize.transaction(async (t) => {
     // Create/update device
     // Create/update bundle
     // Create device pair if complete
   });
   ```

2. **Referential Integrity**
   - Foreign keys enforced
   - Cascade delete (session deletes participants)

---

## Summary

### Key Takeaways

**IndividualSession:**
- Supports 1+ pairs independently controlling their own journey
- Per-participant state management
- Flexible journey selection per pair
- Ideal for independent user experiences within a shared space

**GroupSession:**
- Supports 1+ pairs with synchronized playback
- Shared journey list and playback position
- Auto-pauses previous group sessions
- Ideal for collaborative/guided group experiences

**Architecture:**
- Layered: Controller → Service → DAO → Model
- Real-time via MQTT (devices) + Socket.IO (browser)
- REST API for session lifecycle
- Database for persistence and recovery

**Communication:**
- Session-level commands broadcast to all participants
- Per-participant commands for granular control
- Telemetry feedback for sync validation
- Bridge fallback via Socket.IO for testing

