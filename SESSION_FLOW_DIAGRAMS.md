# NSC Session Flow - Visual Diagrams & Sequences

## 1. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React/TypeScript)                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    DeviceControlPanel.tsx                       │ │
│  │              (Main orchestrator & state management)             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                   │                                  │
│    ┌──────────────────┬──────────┴───────────┬─────────────────┐    │
│    │                  │                      │                 │    │
│    ▼                  ▼                      ▼                 ▼    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐
│  │ SessionType  │  │ DeviceSelect │  │ JourneySelect│  │ Playback │
│  │ Step.tsx     │  │ Step.tsx     │  │ Step.tsx     │  │ Control  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘
│       │                   │                   │               │     │
│       │                   │                   │      ┌────────┴─────┤
│       │                   │                   │      │               │
│       │                   │                   │      ▼               ▼
│       │                   │                   │  ┌──────────────┬──────────────┐
│       │                   │                   │  │ Individual   │ Group        │
│       │                   │                   │  │ Session      │ Session      │
│       │                   │                   │  │ Control.tsx  │ Control.tsx  │
│       │                   │                   │  └──────────────┴──────────────┘
│       │                   │                   │               │
│       └───────────────────┴───────────────────┴───────────────┘
│                             │
│                    ┌────────▼────────┐
│                    │  sessions.ts    │
│                    │  (API Library)  │
│                    └────────┬────────┘
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Axios HTTP Client │
                    └─────────┬──────────┘
                              │
                ┌─────────────┼──────────────┬──────────────┐
                ▼             ▼              ▼              ▼
        ┌────────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐
        │ BACKEND (Node) │ │ MQTT       │ │ Socket.IO│ │ Database     │
        │                │ │ Broker     │ │ Server   │ │ (PostgreSQL) │
        │ SessionCtrl.js │ │            │ │          │ │              │
        │ SessionSvc.js  │ │            │ │          │ │ • Sessions   │
        │                │ │ Relays     │ │ Mirrors  │ │ • Participants
        └────────────────┘ │ commands   │ │ MQTT for │ │ • Devices    │
                           │ & telemetry│ │ testing  │ │ • Journeys   │
                           └────────────┘ └──────────┘ └──────────────┘
                              │             │
                    ┌─────────┴─────────────┘
                    │
                    ▼
            ┌─────────────────┐
            │  Physical       │
            │  Devices        │
            │                 │
            │ • VR Headsets   │
            │ • Haptic Chairs │
            └─────────────────┘
```

---

## 2. Individual Session Creation Sequence

```
ACTOR          FRONTEND           BACKEND            MQTT              DB
(Operator)        │                 │                 │                 │
   │               │                 │                 │                 │
   │──SessionType──│                 │                 │                 │
   │               │                 │                 │                 │
   │──SelectPairs──│                 │                 │                 │
   │               │                 │                 │                 │
   │──SkipJourneys│                 │                 │                 │
   │               │                 │                 │                 │
   │               │──POST /sessions──>                │                 │
   │               │ (vrDeviceId,    │                 │                 │
   │               │  chairDeviceId) │                 │                 │
   │               │                 │                 │                 │
   │               │                 │─Lookup Devices─>│                 │
   │               │                 │                 │                 │
   │               │                 │                 │<─Device Records─│
   │               │                 │                 │                 │
   │               │                 │──CREATE Session──────────────────>│
   │               │                 │ (type=individual, status=ready)   │
   │               │                 │                 │                 │
   │               │                 │<─Session Created─────────────────│
   │               │                 │ (id, status)    │                 │
   │               │                 │                 │                 │
   │               │                 │──CREATE Participant───────────────>│
   │               │                 │ (vr_id, chair_id)                │
   │               │                 │                 │                 │
   │               │                 │<─Participant Created──────────────│
   │               │                 │ (id, status=active)              │
   │               │                 │                 │                 │
   │               │                 │─Publish join_session─>            │
   │               │                 │ (to devices/{vrId}/*) │           │
   │               │                 │ (to devices/{chairId}/*)          │
   │               │                 │                 │                 │
   │               │<─Response OK───│                 │                 │
   │               │ (sessionId,    │                 │                 │
   │               │  participants) │                 │                 │
   │               │                 │                 │                 │
   │<──Activate───│                 │                 │                 │
   │  Session    │                 │                 │                 │
   │               │                 │                 │                 │
   └               └                 └                 └                 └
   
STATUS: Session ready, awaiting playback commands
```

---

## 3. Group Session Creation Sequence

```
ACTOR          FRONTEND           BACKEND            MQTT              DB
(Operator)        │                 │                 │                 │
   │               │                 │                 │                 │
   │─ SessionType─│                 │                 │                 │
   │  (Group)     │                 │                 │                 │
   │               │                 │                 │                 │
   │─SelectPairs  │                 │                 │                 │
   │ (Pair1,Pair2)│                 │                 │                 │
   │               │                 │                 │                 │
   │─SelectJourney│                 │                 │                 │
   │ [journey1]   │                 │                 │                 │
   │               │                 │                 │                 │
   │               │─POST /sessions/group─>            │                 │
   │               │ (members[],     │                 │                 │
   │               │  journeyIds[])  │                 │                 │
   │               │                 │                 │                 │
   │               │                 │─Check running group──────────────>│
   │               │                 │ (where session_type=group,       │
   │               │                 │  status=running)                 │
   │               │                 │                 │                 │
   │               │                 │<─Fetch sessions────────────────┐  │
   │               │                 │                 │                 │
   │               │                 │─PAUSE old group────────────────>│
   │               │                 │ (status=paused) │                 │
   │               │                 │                 │                 │
   │               │                 │─Generate GroupID─┐               │
   │               │                 │ (GRP-YYYYMMDD-NNN)              │
   │               │                 │                 │                 │
   │               │                 │──CREATE Session───────────────>  │
   │               │                 │ (type=group,    │                 │
   │               │                 │  groupId,       │   (Session record
   │               │                 │  journey_ids)   │    with groupId)
   │               │                 │                 │<──Created────────│
   │               │                 │                 │                 │
   │               │                 │──CREATE Participants─────────────>│
   │               │                 │ (bulk for each member)  │         │
   │               │                 │                 │<──Created────────│
   │               │                 │                 │(x2 participants) │
   │               │                 │                 │                 │
   │               │                 │─Broadcast join_session to Pair1──>│
   │               │                 │ (cmd, sessionId, participantId,   │
   │               │                 │  journeyId=123)                   │
   │               │                 │                 │                 │
   │               │                 │─Broadcast join_session to Pair2──>│
   │               │                 │ (same journey)  │                 │
   │               │                 │                 │                 │
   │               │<─Response OK───│                 │                 │
   │               │ (session,      │                 │                 │
   │               │  groupId,      │                 │                 │
   │               │  participants) │                 │                 │
   │               │                 │                 │                 │
   │<──Activate───│                 │                 │                 │
   │  Group Sess. │                 │                 │                 │
   │               │                 │                 │                 │
   └               └                 └                 └                 └
   
STATUS: Group session ready, all devices notified of same journey(s)
```

---

## 4. Individual Session Playback Sequence

```
ACTOR          FRONTEND           BACKEND            MQTT             Devices
(Operator)        │                 │                 │                 │
   │               │                 │                 │                 │
   │  Click Play   │                 │                 │                 │
   │   (Pair 1)    │                 │                 │                 │
   │               │                 │                 │                 │
   │               │─Select Journey──│                 │                 │
   │               │ journeyId=123   │                 │                 │
   │               │                 │                 │                 │
   │               │──POST /cmd/select_journey─>       │                 │
   │               │ (participantId, journeyId=123)    │                 │
   │               │                 │                 │                 │
   │               │                 │─Update Participant──────────────>│
   │               │                 │ (current_journey_id=123) │        │
   │               │                 │                 │<──Updated───────│
   │               │                 │                 │                 │
   │               │                 │─Publish select_journey──>         │
   │               │                 │ (to devices/{vrId}/commands/)     │
   │               │                 │ (to devices/{chairId}/commands/)  │
   │               │                 │                 │                 │
   │               │                 │<─Response OK───│                 │
   │               │                 │ (cmd published)│                 │
   │               │                 │                 │                 │
   │<─Update UI─│                 │                 │                 │
   │ (show journey) │                 │                 │                 │
   │               │                 │                 │     ┌──Process──>
   │               │                 │                 │  ┌──Device Event
   │               │                 │                 │  │  (select_journey)
   │               │                 │                 │  │
   │               │                 │                 │  ├──Load Media
   │               │                 │                 │  │
   │               │                 │                 │  └──Ready
   │               │                 │                 │     │
   │               │<─ TELEMETRY ────────────────────<─ Devices publish
   │               │ (journeyId=123, (positions, status) │
   │               │  status=idle)   │                 │
   │               │                 │                 │
   │  Click Play   │                 │                 │
   │               │                 │                 │
   │               │──POST /cmd/play────────────────>│
   │               │ (participantId, positionMs=0)    │
   │               │                 │                 │
   │               │                 │─Publish start command─>
   │               │                 │ (startAtMs,    │
   │               │                 │  durationMs)   │
   │               │                 │                 │
   │               │                 │─Update Session─────────────────>│
   │               │                 │ (status=running) │               │
   │               │                 │                 │<──Updated──────│
   │               │                 │<─Response OK───│                 │
   │               │                 │ (cmd published)│                 │
   │               │                 │                 │                 │
   │<─Update UI─│                 │                 │     ┌──Start Playback
   │ (play button)  │                 │                 │  ┌──Device starts
   │ (seek slider)  │                 │                 │  │  playback
   │               │                 │                 │  │
   │               │                 │                 │  ├──Publish
   │<─ TELEMETRY ────────────────────<──────────────<── telemetry
   │ (continuous  │                 │ (positionMs,   │ (positions)
   │  positions)   │                 │  status=active)│
   │               │                 │                 │
   │  Click Pause  │                 │                 │
   │               │                 │                 │
   │               │──POST /cmd/pause────────────────>│
   │               │ (participantId, positionMs=15000)│
   │               │                 │                 │
   │               │                 │─Update Session─────────────────>│
   │               │                 │ (status=paused, │               │
   │               │                 │  last_position_ms=15000)         │
   │               │                 │                 │<──Updated──────│
   │               │                 │                 │                 │
   │               │                 │─Publish pause command─>          │
   │               │                 │                 │                 │
   │               │<─Response OK───│                 │    ┌──Pause   │
   │               │ (cmd published)│                 │ ┌──Device│    │
   │               │                 │                 │ │ pauses │    │
   │               │                 │                 │ │        │    │
   │               │                 │<─ TELEMETRY────<─ Devices report│
   │<─Update UI─│                 │ (status=paused) │ paused │
   │ (pause button)│                 │                 │        │
   │               │                 │                 │        │
   └               └                 └                 └        └
```

---

## 5. Group Session Playback Sequence

```
ACTOR          FRONTEND           BACKEND            MQTT             Devices
(Operator)        │                 │                 │                 │
   │               │                 │                 │                 │
   │  Click Play   │                 │                 │                 │
   │  (All Pairs)  │                 │                 │                 │
   │               │                 │                 │                 │
   │               │──POST /sessions/{id}/commands/play─>               │
   │               │ (cmd: "start", positionMs=0)   │                  │
   │               │                 │                 │                 │
   │               │                 │─Update Session─────────────────>│
   │               │                 │ (status=running) │               │
   │               │                 │                 │<──Updated──────│
   │               │                 │                 │                 │
   │               │                 │─Lookup all Participants─────────>│
   │               │                 │ (where session_id=xxx) │         │
   │               │                 │                 │<──Participants──│
   │               │                 │                 │ (Pair1, Pair2)  │
   │               │                 │                 │                 │
   │               │                 │─Broadcast play to Pair1 VR─────>│
   │               │                 │ (devices/{vrId1}/commands/start) │
   │               │                 │                 │                 │
   │               │                 │─Broadcast play to Pair1 Chair──>│
   │               │                 │ (devices/{chairId1}/commands/)   │
   │               │                 │                 │                 │
   │               │                 │─Broadcast play to Pair2 VR─────>│
   │               │                 │ (devices/{vrId2}/commands/)      │
   │               │                 │                 │                 │
   │               │                 │─Broadcast play to Pair2 Chair──>│
   │               │                 │ (devices/{chairId2}/commands/)   │
   │               │                 │                 │                 │
   │               │<─Response OK───│                 │     ┌────All───>
   │               │ (cmd broadcast)│                 │  ┌──Devices│   │
   │               │                 │                 │  │ start at  │   │
   │               │                 │                 │  │ same time │   │
   │               │                 │                 │  │           │   │
   │<─Update UI─│                 │                 │  └──With    │
   │ (show playing) │                 │                 │  sync buffer   │
   │               │                 │                 │                 │
   │               │<─ TELEMETRY ────────────────────<─ All devices publish
   │               │ (all pairs     │                 │ positions       │
   │               │  sending       │                 │ (should be close)
   │               │  similar       │                 │                 │
   │               │  positions)    │                 │                 │
   │               │                 │                 │                 │
   │  Pair 2       │                 │                 │                 │
   │  goes offline │                 │                 │                 │
   │               │                 │                 │                 │
   │<─Alert: Pair2 Offline           │                 │                 │
   │               │                 │                 │                 │
   │               │ (Optional auto-pause)             │                 │
   │               │                 │                 │                 │
   │  Click Pause  │                 │                 │                 │
   │  (Manual)     │                 │                 │                 │
   │               │                 │                 │                 │
   │               │──POST /commands/pause────────────>│                 │
   │               │ (cmd: "pause")  │                 │                 │
   │               │                 │                 │                 │
   │               │                 │─Update Session─────────────────>│
   │               │                 │ (status=paused) │               │
   │               │                 │                 │<──Updated──────│
   │               │                 │                 │                 │
   │               │                 │─Broadcast pause to all devices──>│
   │               │                 │ (to devices/{*/commands/pause})  │
   │               │                 │                 │                 │
   │               │<─Response OK───│                 │    ┌──All───>
   │               │ (cmd broadcast)│                 │ ┌──Devices│    │
   │               │                 │                 │ │ pause    │    │
   │               │                 │                 │ │ (including    │
   │               │                 │                 │ │  offline)     │
   │               │                 │                 │ │              │
   │<─Update UI─│                 │                 │ └──Synced    │
   │ (pause button)│                 │                 │  pause pos      │
   │               │                 │                 │                 │
   └               └                 └                 └                 └
```

---

## 6. Device Offline Handling

```
┌────────────────────────────────────────────────────────┐
│          Device Status Monitoring Flow                  │
└────────────────────────────────────────────────────────┘

Device Online:
  ├─ Sends heartbeat/telemetry periodically
  ├─ lastSeenAt updated in frontend state
  └─ Threshold: 30 seconds (if not seen, mark offline)

Device Goes Offline:
  ├─ Stop receiving telemetry
  ├─ Frontend detects: Date.now() - lastSeenAt > 30s
  ├─ Update deviceInfoById[deviceId].status = "offline"
  │
  └─ INDIVIDUAL SESSION:
     ├─ Pair marked as offline
     ├─ Controls disabled for that pair
     └─ Other pairs continue unaffected
     
  └─ GROUP SESSION:
     ├─ Detect sessionOfflineDevices
     ├─ Auto-pause group session
     ├─ Send pause command to ALL devices
     ├─ Operator can retry when device comes back
     └─ All participants pause together

Device Comes Back Online:
  ├─ Sends new telemetry
  ├─ lastSeenAt updated
  ├─ deviceInfoById.status = "active"
  │
  └─ INDIVIDUAL SESSION:
     ├─ Pair controls re-enabled
     ├─ Device can rejoin playback
     └─ Sync to current position
     
  └─ GROUP SESSION:
     ├─ Can manually resume from paused state
     ├─ Or re-broadcast join_session
     └─ Group resumes with all available devices
```

---

## 7. State Machine Diagrams

### Individual Session State Machine

```
              ┌─────────────┐
              │   CREATED   │
              │ (pending)   │
              └──────┬──────┘
                     │
                     │ Session created
                     │ Participants added
                     │ Journeys selected
                     ▼
              ┌─────────────┐
              │    READY    │
              │             │
              └──────┬──────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         │ Play command          │ Stop command
         ▼                       ▼
    ┌─────────┐          ┌─────────────┐
    │ RUNNING │          │   STOPPED   │
    │         │          │ (completed) │
    └────┬────┘          └─────────────┘
         │
    ┌────┴──────────────────────┐
    │                           │
    │ Pause command             │ Stop command
    ▼                           ▼
┌─────────┐              ┌─────────────┐
│ PAUSED  │──Play────┐   │   STOPPED   │
│         │ Resume   │   │ (completed) │
└────┬────┘         │   └─────────────┘
     │              │
     └──────────────┘

Note: Can pause/play multiple times
      Each participant can have different journey
      Session persists until stopped/completed
```

### Group Session State Machine

```
              ┌──────────────┐
              │    CREATED   │
              │ (pending)    │
              │              │
              │ Auto-pauses  │
              │ previous     │
              │ group session│
              └───────┬──────┘
                      │
                      │ All participants added
                      │ Shared journey set
                      ▼
              ┌──────────────┐
              │     READY    │
              │              │
              │ All devices  │
              │ notified     │
              └───────┬──────┘
                      │
         ┌────────────┴───────────┐
         │                        │
         │ Play command           │ Stop command
         ▼                        ▼
    ┌────────────┐         ┌────────────────┐
    │  RUNNING   │         │  STOPPED       │
    │            │         │  (completed)   │
    │ All pairs  │         └────────────────┘
    │ sync play  │
    └─────┬──────┘
          │
    ┌─────┴────────────────────────┐
    │                              │
    │ Pause/Auto-pause             │ Stop command
    ▼                              ▼
┌────────────┐            ┌────────────────┐
│  PAUSED    │─Play────┐  │  STOPPED       │
│            │ Resume  │  │  (completed)   │
│ All pause  │         │  └────────────────┘
│ together   │         │
└─────┬──────┘         │
      └────────────────┘

Note: All participants always synchronized
      One group session at a time (others auto-paused)
      Auto-pause if device(s) offline
      Journey carousel shared by all
```

---

## 8. Real-time Communication Topology

```
┌─────────────────────────────────────┐
│         VR Devices (MQTT)           │
│ ┌──────────────────────────────────┐│
│ │ Listens on:                      ││
│ │ • devices/{hwId}/commands/*      ││
│ │ • sessions/{sid}/commands/*      ││
│ │ • join_session, leave_session    ││
│ │                                  ││
│ │ Publishes:                       ││
│ │ • devices/{hwId}/telemetry/*     ││
│ │ • Position, status, events       ││
│ └────────┬────────────────────────┬┘
│          │                        │
└──────────┼────────────────────────┼──────────┐
           │                        │          │
        MQTT                    MQTT        MQTT
        Pub/Sub                 Pub/Sub     Pub/Sub
           │                        │          │
    ┌──────▼────────┐        ┌──────▼──┐   ┌──▼────────┐
    │  MQTT Broker  │        │ Chair   │   │ Chair     │
    │   (Mosquitto) │        │ Device  │   │ Device    │
    └──────┬────────┘        └──────┬──┘   └──┬────────┘
           │                        │          │
           │ Bridge/Subscribe       │          │
           │ (Real-time relay)      │          │
           │                        │          │
           ▼                        ▼          ▼
    ┌──────────────────────────────────────┐
    │       Backend (Node.js)              │
    │   (SessionService.js)                │
    │                                      │
    │ • Listens to MQTT topics             │
    │ • Updates session state              │
    │ • Publishes commands to devices      │
    └──────────┬───────────────────────────┘
               │
         ┌─────┼──────┐
         │     │      │
         ▼     ▼      ▼
    REST API  Socket  Database
    (HTTP)    .IO    (PostgreSQL)
       │       │        │
       └───┬───┴────┬───┘
           │        │
    ┌──────▼──┐  ┌──▼────────────┐
    │ Frontend│  │ Persistence   │
    │ (React) │  │ • Session     │
    │         │  │ • Participants│
    │ • Real- │  │ • Metrics     │
    │  time   │  │ • Logs        │
    │  state  │  └───────────────┘
    │ • UI    │
    │  updates│
    └─────────┘
```

---

## 9. Participant Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────┐
│     Individual Session - Participant Lifecycle              │
└─────────────────────────────────────────────────────────────┘

Step 1: Initial Participant (Auto-created)
┌────────────────────┐
│ createIndividual   │
│ {vrId, chairId}    │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ SessionParticipant │  id, session_id
│ CREATED            │  vr_device_id, chair_device_id
│ status: active     │  language: null
│                    │  current_journey_id: null
└────────┬───────────┘
         │
Step 2: Select Journey
         │
         ▼
┌────────────────────┐
│ commandParticipant │  select_journey
│ journeyId=123      │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ SessionParticipant │  current_journey_id: 123
│ UPDATED            │  language: en
│                    │
└────────┬───────────┘
         │
Step 3: Playback Controls
         │ (Play/Pause/Seek/Stop all use same participant)
         │
         ▼
┌────────────────────┐
│ Participant Active │  Playing journey 123
│ During Session     │  Sync metrics tracked
└────────┬───────────┘
         │
Step 4: Remove/Leave
         │
         ▼
┌────────────────────┐
│ removeParticipant  │  Send leave_session
│ OR                 │  Delete from DB
│ Device disconnects │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ SessionParticipant │  status: left
│ INACTIVE           │  left_at: timestamp
└────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│     Group Session - Participant Lifecycle                   │
└─────────────────────────────────────────────────────────────┘

Step 1: Group Session Created → All Participants Bulk-Created
┌────────────────────┐
│ createGroupSession  │
│ members: [          │
│   {vr1, chair1},    │
│   {vr2, chair2}     │
│ ],                  │
│ journeyIds: [123]   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Session record     │  status: ready
│ CREATED            │  journey_ids: [123]
└────────┬───────────┘
         │
         ├──create──►┌──────────────────┐
         │           │ Participant 1    │  status: active
         │           │ (vr1, chair1)    │  current_journey_id: 123
         │           │ CREATED          │
         │           └──────────────────┘
         │
         └──create──►┌──────────────────┐
                     │ Participant 2    │  status: active
                     │ (vr2, chair2)    │  current_journey_id: 123
                     │ CREATED          │
                     └──────────────────┘

Step 2: All Participants Receive Same Commands
┌────────────────────┐
│ commandSession     │  cmd: play/pause/seek/stop
│ GROUP COMMAND      │  Broadcast to ALL participants
└────────┬───────────┘
         │
         ├──to──►┌──────────────────┐
         │       │ Participant 1    │  Receives command
         │       │ Updates state    │
         │       │ SYNC POINT       │
         │       └──────────────────┘
         │
         └──to──►┌──────────────────┐
                 │ Participant 2    │  Receives same command
                 │ Updates state    │  (should be synchronized)
                 │ SYNC POINT       │
                 └──────────────────┘

Step 3: Session End
         │ (Any participant can trigger)
         ▼
┌────────────────────┐
│ commandSession     │  cmd: stop
│ Stop entire group  │
└────────┬───────────┘
         │
         ├──stop──►┌──────────────────┐
         │         │ All Participants │  status: completed
         │         │ Session STOPPED  │
         │         └──────────────────┘
         │
         ▼
     CLEANUP
   (Session marked completed)
```

---

## 10. Data Flow: Journey Selection

```
Individual Session Journey Selection:
────────────────────────────────────

UI Flow:
┌──────────────────────────┐
│ IndividualSessionControl │
│ (Pair 1, Pair 2, ...)    │
└────┬─────────────────────┘
     │
     ├─ For Each Pair:
     │  ├─ Find journey for this pair
     │  │  (from selectedJourneyByPair[key])
     │  │
     │  └─ Render JourneyCarousel
     │     ├─ Current: journey display
     │     └─ On select: call commandParticipant
     │
     ▼
┌──────────────────────────┐
│ User clicks next/prev    │
│ in carousel              │
└────┬─────────────────────┘
     │
     ├─ journeyId = newJourney.id
     │
     ├─ Call: commandParticipant(
     │          sessionId,
     │          participantId,
     │          "select_journey",
     │          {journeyId: 123}
     │       )
     │
     ▼ (API Request)
┌──────────────────────────┐
│ Backend:                 │
│ SessionService.          │
│ commandParticipant()     │
└────┬─────────────────────┘
     │
     ├─ Validate participant exists
     │
     ├─ Publish MQTT:
     │  Topic: sessions/{sid}/participants/{pid}/commands/select_journey
     │  Payload: {cmd, journeyId, language}
     │
     ├─ Also publish to device topics:
     │  devices/{vrId}/commands/select_journey
     │  devices/{chairId}/commands/select_journey
     │
     ├─ Update database:
     │  SessionParticipant.update({
     │    current_journey_id: 123,
     │    language: "en"
     │  })
     │
     ▼
┌──────────────────────────┐
│ Device receives MQTT:    │
│ select_journey           │
└────┬─────────────────────┘
     │
     ├─ Load journey 123
     ├─ Load video
     ├─ Prepare audio track
     ├─ Ready for playback
     │
     └─ Publish telemetry:
        devices/{vrId}/telemetry/position
        {
          journeyId: 123,
          status: "ready",
          positionMs: 0
        }

     ▼
┌──────────────────────────┐
│ Frontend receives        │
│ telemetry via Socket.IO  │
└────┬─────────────────────┘
     │
     ├─ Update deviceInfoById[vrId]
     │  {currentJourneyId: 123, status: "ready"}
     │
     ├─ Update UI:
     │  - Video player source changes
     │  - Duration updates
     │  - Play button enables
     │
     └─ Mark as ready


Group Session Journey Selection:
────────────────────────────────

UI Flow:
┌──────────────────────────┐
│ GroupSessionController   │
│ (All Pairs synchronized) │
└────┬─────────────────────┘
     │
     ├─ Single journey carousel
     │  (all pairs see same journeys)
     │
     ├─ On next/prev:
     │  ├─ journeyId = newJourney.id
     │  │
     │  └─ Call: commandSession(
     │            sessionId,
     │            "select_journey",
     │            {journeyId: 123}
     │         )
     │
     ▼ (API Request)
┌──────────────────────────┐
│ Backend:                 │
│ SessionService.          │
│ commandSession()         │
└────┬─────────────────────┘
     │
     ├─ Publish to main session topic:
     │  sessions/{sid}/commands/select_journey
     │
     ├─ Lookup ALL participants
     │  SessionParticipant.findAll(...)
     │
     ├─ For EACH participant:
     │  ├─ Publish to device topics:
     │  │  devices/{vrId}/commands/select_journey
     │  │  devices/{chairId}/commands/select_journey
     │  │
     │  └─ (Same payload sent to all)
     │
     ├─ Update Session:
     │  Session.update({
     │    last_command: "select_journey"
     │  })
     │
     ▼
┌──────────────────────────┐
│ All Devices receive      │
│ SAME select_journey cmd  │
└────┬─────────────────────┘
     │
     ├─ VR1: Load journey 123
     ├─ Chair1: Load journey 123
     ├─ VR2: Load journey 123
     ├─ Chair2: Load journey 123
     │
     └─ Each publishes telemetry
        (should have synchronized
         times due to sync buffer)

     ▼
┌──────────────────────────┐
│ Frontend receives        │
│ Multiple telemetry msgs  │
└────┬─────────────────────┘
     │
     ├─ Update all deviceInfoById entries
     │  All should show: {journeyId: 123, status: "ready"}
     │
     ├─ Update shared UI:
     │  - Single video player updates
     │  - Duration reflects shared journey
     │  - All pairs ready indicator
     │
     └─ Sync validation:
        Check if all devices report same journeyId
        If diverge, trigger sync command
```

---

This comprehensive set of diagrams should help visualize:
1. **Architecture** - How components interact
2. **Sequences** - Step-by-step execution flows
3. **State Machines** - Valid session states
4. **Communication** - Real-time message flow
5. **Lifecycle** - How entities are created/managed
6. **Data Flow** - How information moves through the system

