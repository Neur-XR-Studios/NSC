const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { Session, VRDevice, ChairDevice, SessionParticipant, journey, JourneyAudioTrack } = require('../models');
const mqttService = require('./MqttService');

class SessionService {
  async startSession({ vrDeviceId, chairDeviceId, journeyId, journeyIds, groupId, session_type }) {
    const type = session_type === 'group' ? 'group' : 'individual';

    let vr = null;
    let chair = null;
    const errors = { missingFields: [], notFoundDevices: [], notFoundJourneys: [] };
    const journeys = Array.isArray(journeyIds) ? journeyIds : (journeyId != null ? [journeyId] : []);

    if (type === 'individual') {
      if (!vrDeviceId) errors.missingFields.push('vrDeviceId');
    }

    if (journeys.length === 0) errors.missingFields.push('journeyIds');

    if (vrDeviceId) {
      // Try by new string ID first (VR_#001 format), then fallback to hardware deviceId
      vr = await VRDevice.findByPk(vrDeviceId);
      if (!vr) vr = await VRDevice.findOne({ where: { deviceId: vrDeviceId } });
      if (!vr) errors.notFoundDevices.push({ field: 'vrDeviceId', value: vrDeviceId });
    }
    if (chairDeviceId) {
      chair = await ChairDevice.findByPk(chairDeviceId);
      if (!chair) chair = await ChairDevice.findOne({ where: { deviceId: chairDeviceId } });
      if (!chair) errors.notFoundDevices.push({ field: 'chairDeviceId', value: chairDeviceId });
    }

    if (journeys.length > 0) {
      const found = await journey.findAll({ where: { id: { [Op.in]: journeys } }, attributes: ['id'] });
      const foundIds = new Set(found.map(j => j.id));
      journeys.forEach(id => { if (!foundIds.has(id)) errors.notFoundJourneys.push(id); });
    }

    if (errors.missingFields.length || errors.notFoundDevices.length || errors.notFoundJourneys.length) {
      return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Validation failed', errors } };
    }


    // Auto-generate group_id if group session and not provided
    let finalGroupId = groupId || null;
    if (type === 'group' && !finalGroupId) {
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const prefix = `GRP-${y}${m}${d}`;
      const count = await Session.count({ where: { group_id: { [Op.like]: `${prefix}-%` } } });
      const seq = String(count + 1).padStart(3, '0');
      finalGroupId = `${prefix}-${seq}`;
    }

    const session = await Session.create({
      id: uuidv4(),
      vr_device_id: vr ? vr.id : null,
      chair_device_id: chair ? chair.id : null,
      status: 'ready',
      group_id: finalGroupId,
      journey_ids: journeys.length > 0 ? journeys : null,
      session_type: type,
    });

    // Broadcast join_session to devices so they attach to the session topics immediately
    try {
      const ts = new Date().toISOString();
      const payload = { sessionId: session.id, journeyId: journeys, timestamp: ts };
      if (vr?.deviceId) {
        mqttService.publish(`devices/${vr.deviceId}/commands/join_session`, payload, { qos: 1, retain: false });
      }
      if (chair?.deviceId) {
        mqttService.publish(`devices/${chair.deviceId}/commands/join_session`, payload, { qos: 1, retain: false });
      }
      // Also mirror to Socket.IO bridge to reach web-bridged devices immediately
      try { global.io?.emit('mqtt_message', { topic: `devices/${vr?.deviceId || ''}/commands/join_session`, payload }); } catch { /* noop */ }
      try { global.io?.emit('mqtt_message', { topic: `devices/${chair?.deviceId || ''}/commands/join_session`, payload }); } catch { /* noop */ }
    } catch (e) {
      // Non-fatal
    }

    return { statusCode: httpStatus.OK, response: { status: true, data: session } };
  }

  /**
   * Create a GROUP session with multiple participants (each participant maps VR+Chair)
   * payload: { members: [{ vrDeviceId, chairDeviceId, language? }], groupId?, journeyId?, journeyIds? }
   * If any running group session exists, pause it first (per rule).
   */
  async createGroupSession({ members = [], groupId, journeyId, journeyIds }) {
    const errors = { missingFields: [], members: [], notFoundJourneys: [] };
    if (!Array.isArray(members) || members.length === 0) {
      errors.missingFields.push('members');
    }

    const journeys = Array.isArray(journeyIds) ? journeyIds : (journeyId != null ? [journeyId] : []);
    if (journeys.length === 0) {
      errors.missingFields.push('journeyIds');
    }

    if (journeys.length > 0) {
      const found = await journey.findAll({ where: { id: { [Op.in]: journeys } }, attributes: ['id'] });
      const foundIds = new Set(found.map(j => j.id));
      journeys.forEach(id => { if (!foundIds.has(id)) errors.notFoundJourneys.push(id); });
    }

    // Auto-generate group id if not provided
    let finalGroupId = groupId;
    if (!finalGroupId) {
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const prefix = `GRP-${y}${m}${d}`;
      const count = await Session.count({ where: { group_id: { [Op.like]: `${prefix}-%` } } });
      const seq = String(count + 1).padStart(3, '0');
      finalGroupId = `${prefix}-${seq}`;
    }

    // Pause any running group sessions
    await Session.update({ status: 'paused' }, { where: { session_type: 'group', status: 'running' } });

    const session = await Session.create({
      id: uuidv4(),
      status: 'ready',
      group_id: finalGroupId,
      journey_ids: journeys.length > 0 ? journeys : null,
      session_type: 'group',
    });

    // Create participants
    const participantsPayload = [];
    const joinTargets = [];
    for (const m of members) {
      const memberErrors = { index: participantsPayload.length, missingFields: [], notFoundDevices: [] };
      if (!m.vrDeviceId) memberErrors.missingFields.push('vrDeviceId');
      if (!m.chairDeviceId) memberErrors.missingFields.push('chairDeviceId');

      const vr = m.vrDeviceId ? await VRDevice.findByPk(m.vrDeviceId) || await VRDevice.findOne({ where: { deviceId: m.vrDeviceId } }) : null;
      const chair = m.chairDeviceId ? await ChairDevice.findByPk(m.chairDeviceId) || await ChairDevice.findOne({ where: { deviceId: m.chairDeviceId } }) : null;
      if (!vr && m.vrDeviceId) memberErrors.notFoundDevices.push({ field: 'vrDeviceId', value: m.vrDeviceId });
      if (!chair && m.chairDeviceId) memberErrors.notFoundDevices.push({ field: 'chairDeviceId', value: m.chairDeviceId });

      if (memberErrors.missingFields.length || memberErrors.notFoundDevices.length) {
        errors.members.push(memberErrors);
        continue;
      }
      participantsPayload.push({
        id: uuidv4(),
        session_id: session.id,
        vr_device_id: vr.id,
        chair_device_id: chair.id,
        language: m.language || null,
        joined_at: new Date(),
      });
      // Keep hardware ids for broadcast
      joinTargets.push({ vrHw: vr.deviceId, chairHw: chair.deviceId });
    }

    if (errors.missingFields.length || errors.members.length || errors.notFoundJourneys.length) {
      return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Validation failed', errors } };
    }

    await SessionParticipant.bulkCreate(participantsPayload);

    // Broadcast join_session to all VR/Chair devices in the group
    try {
      const ts = new Date().toISOString();
      const payload = { sessionId: session.id, journeyId: journeys, timestamp: ts };
      for (const tgt of joinTargets) {
        if (tgt.vrHw) mqttService.publish(`devices/${tgt.vrHw}/commands/join_session`, payload, { qos: 1, retain: false });
        if (tgt.chairHw) mqttService.publish(`devices/${tgt.chairHw}/commands/join_session`, payload, { qos: 1, retain: false });
        try { if (tgt.vrHw) global.io?.emit('mqtt_message', { topic: `devices/${tgt.vrHw}/commands/join_session`, payload }); } catch { /* noop */ }
        try { if (tgt.chairHw) global.io?.emit('mqtt_message', { topic: `devices/${tgt.chairHw}/commands/join_session`, payload }); } catch { /* noop */ }
      }
    } catch (e) {
      // Non-fatal
    }

    return { statusCode: httpStatus.OK, response: { status: true, data: { session, groupId: finalGroupId, participants: participantsPayload } } };
  }

  /**
   * Send a command to a session and persist session state updates
   */
  async commandAndUpdate({ sessionId, cmd, positionMs, durationMs }) {
    const send = this.commandSession({ sessionId, cmd, positionMs, durationMs });
    const result = await send;

    const session = await Session.findByPk(sessionId);
    if (session) {
      const nowMs = Date.now();
      switch (cmd) {
        case 'start':
          await session.update({ status: 'running', start_time_ms: nowMs + 1500, last_command: 'start' });
          break;
        case 'pause':
          await session.update({ status: 'paused', last_command: 'pause', last_position_ms: positionMs ?? session.last_position_ms });
          break;
        case 'seek':
          await session.update({ last_command: 'seek', last_position_ms: positionMs ?? session.last_position_ms });
          break;
        case 'stop':
          await session.update({ status: 'stopped', last_command: 'stop', overall_status: 'completed' });
          break;
        case 'sync':
          await session.update({ last_command: 'sync' });
          break;
        default:
          break;
      }
    }

    return result;
  }

  async listSessions({ page = 1, limit = 20, status = 'on_going' }) {
    const offset = (Number(page) - 1) * Number(limit);
    const where = {};
    const BASE_URL = process.env.BASE_URL || 'http://localhost:8001';

    if (status) {
      where.overall_status = status;
    }

    const { rows, count } = await Session.findAndCountAll({
      where,
      include: [
        { model: VRDevice, as: 'vr' },
        { model: ChairDevice, as: 'chair' }
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: Number(limit),
    });

    const allJourneyIds = new Set();
    const allSessionIds = [];
    rows.forEach((s) => {
      const ids = Array.isArray(s.journey_ids) ? s.journey_ids : [];
      ids.forEach((id) => allJourneyIds.add(String(id)));
      allSessionIds.push(typeof s.toJSON === 'function' ? s.toJSON().id : s.id);
    });

    let journeysById = new Map();
    let audioTracksByJourney = new Map();
    let videosById = new Map();
    let telemetriesById = new Map();

    if (allJourneyIds.size > 0) {
      const { journey, journey_audio_track: JourneyAudioTrack, audio_track: AudioTrack, video: Video, telemetry: Telemetry } = require('../models');

      const journeys = await journey.findAll({
        where: { id: { [Op.in]: Array.from(allJourneyIds).map((v) => parseInt(v, 10)) } }
      });
      journeysById = new Map(journeys.map(j => [String(j.id), j]));

      const journeyAudioTracks = await JourneyAudioTrack.findAll({
        where: { journey_id: { [Op.in]: Array.from(allJourneyIds).map((v) => parseInt(v, 10)) } },
        include: [{ model: AudioTrack, as: 'audioTrack' }]
      });

      // Map multiple audio tracks per journey
      journeyAudioTracks.forEach(track => {
        const key = String(track.journey_id);
        if (!audioTracksByJourney.has(key)) {
          audioTracksByJourney.set(key, []);
        }
        audioTracksByJourney.get(key).push(track);
      });

      const journeyVideoIds = journeys.map(j => j.video_id).filter(Boolean);
      const journeyTelemetryIds = journeys.map(j => j.telemetry_id).filter(Boolean);

      if (journeyVideoIds.length > 0) {
        const videos = await Video.findAll({
          where: { id: { [Op.in]: journeyVideoIds } }
        });
        videosById = new Map(videos.map(v => [v.id, v]));
      }

      if (journeyTelemetryIds.length > 0) {
        const telemetries = await Telemetry.findAll({
          where: { id: { [Op.in]: journeyTelemetryIds } }
        });
        telemetriesById = new Map(telemetries.map(t => [t.id, t]));
      }
    }

    // Collect raw participants per session (no device details)
    const participantsBySession = new Map();
    if (allSessionIds.length > 0) {
      const participants = await SessionParticipant.findAll({
        where: { session_id: { [Op.in]: allSessionIds } },
      });
      for (const p of participants) {
        const sid = p.session_id;
        if (!participantsBySession.has(sid)) participantsBySession.set(sid, []);
        participantsBySession.set(sid, [...participantsBySession.get(sid), (p.toJSON ? p.toJSON() : p)]);
      }
    }

    const enriched = rows.map((s) => {
      const plain = typeof s.toJSON === 'function' ? s.toJSON() : s;
      const ids = Array.isArray(plain.journey_ids) ? plain.journey_ids : [];

      // attach participants collected in batch (raw rows)

      const enrichedJourneys = ids.map((id) => {
        const j = journeysById.get(String(id));
        if (!j) return null;

        const journeyPlain = typeof j.toJSON === 'function' ? j.toJSON() : j;
        const journeyTracks = audioTracksByJourney.get(String(id)) || [];
        const video = videosById.get(journeyPlain.video_id);
        const telemetry = telemetriesById.get(journeyPlain.telemetry_id);

        return {
          journey: {
            ...journeyPlain,
            audio_tracks: journeyTracks.map(track => {
              const audioUrl = track.audio_url
                ? `${BASE_URL}/audio/${track.audio_url}`
                : track.audioTrack?.audio_url
                  ? `${BASE_URL}/audio/${track.audioTrack.audio_url}`
                  : null;

              return {
                id: track.id,
                journey_id: track.journey_id,
                audio_track_id: track.audio_track_id,
                audio_url: audioUrl,
                order_index: track.order_index,
                title: track.title,
                audio_track: track.audioTrack ? {
                  id: track.audioTrack.id,
                  language_code: track.audioTrack.language_code,
                  audio_url: `${BASE_URL}/audio/${track.audioTrack.audio_url}`,
                  mime_type: track.audioTrack.mime_type
                } : null
              };
            })
          },
          video: video ? {
            id: video.id,
            title: video.title,
            description: video.description,
            duration_ms: video.duration_ms,
            video_url: video.video_url,
            mime_type: video.mime_type,
            thumbnail_url: video.thumbnail_url,
            url: `${BASE_URL}/video/${video.video_url}`
          } : null,
          telemetry: telemetry ? {
            id: telemetry.id,
            telemetry_url: telemetry.telemetry_url,
            version: telemetry.version,
            format: telemetry.format,
            url: `${BASE_URL}/telemetry/${telemetry.telemetry_url}`
          } : null
        };
      }).filter(Boolean);

      return {
        ...plain,
        journeys: enrichedJourneys,
        participants: participantsBySession.get(plain.id) || []
      };
    });

    return {
      statusCode: httpStatus.OK,
      response: {
        status: true,
        code: 200,
        message: 'Sessions fetched',
        data: {
          data: enriched,
          total: count,
          page: Number(page),
          limit: Number(limit),
        },
      },
    };
  }



  async getById(sessionId) {
    const session = await Session.findByPk(sessionId, {
      include: [
        { model: VRDevice, as: 'vr' },
        { model: ChairDevice, as: 'chair' },
        // Participants removed as requested
      ],
    });

    if (!session) {
      return {
        statusCode: httpStatus.NOT_FOUND,
        response: { status: false, message: 'Session not found' },
      };
    }

    const BASE_URL = process.env.BASE_URL || 'http://localhost:8001';
    const plain = typeof session.toJSON === 'function' ? session.toJSON() : session;
    const journeyIds = Array.isArray(plain.journey_ids) ? plain.journey_ids : [];

    let enrichedJourneys = [];

    if (journeyIds.length > 0) {
      const {
        journey: Journey,
        journey_audio_track: JourneyAudioTrack,
        audio_track: AudioTrack,
        video: Video,
        telemetry: Telemetry,
      } = require('../models');

      const journeys = await Journey.findAll({
        where: { id: { [Op.in]: journeyIds } },
      });

      const journeyAudioTracks = await JourneyAudioTrack.findAll({
        where: { journey_id: { [Op.in]: journeyIds } },
        include: [{ model: AudioTrack, as: 'audioTrack' }],
      });

      // Group audio tracks per journey
      const audioTracksByJourney = new Map();
      journeyAudioTracks.forEach((track) => {
        if (!audioTracksByJourney.has(track.journey_id)) {
          audioTracksByJourney.set(track.journey_id, []);
        }
        audioTracksByJourney.get(track.journey_id).push(track);
      });

      const journeyVideoIds = journeys.map((j) => j.video_id).filter(Boolean);
      const journeyTelemetryIds = journeys.map((j) => j.telemetry_id).filter(Boolean);

      const videos = journeyVideoIds.length
        ? await Video.findAll({ where: { id: { [Op.in]: journeyVideoIds } } })
        : [];
      const telemetries = journeyTelemetryIds.length
        ? await Telemetry.findAll({ where: { id: { [Op.in]: journeyTelemetryIds } } })
        : [];

      const videosById = new Map(videos.map((v) => [v.id, v]));
      const telemetriesById = new Map(telemetries.map((t) => [t.id, t]));

      enrichedJourneys = journeys.map((j) => {
        const jPlain = typeof j.toJSON === 'function' ? j.toJSON() : j;
        const tracks = audioTracksByJourney.get(j.id) || [];
        const video = videosById.get(jPlain.video_id);
        const telemetry = telemetriesById.get(jPlain.telemetry_id);

        return {
          journey: {
            ...jPlain,
            audio_tracks: tracks.map((track) => {
              const audioUrl = track.audio_url
                ? `${BASE_URL}/audio/${track.audio_url}`
                : track.audioTrack?.audio_url
                  ? `${BASE_URL}/audio/${track.audioTrack.audio_url}`
                  : null;

              return {
                id: track.id,
                journey_id: track.journey_id,
                audio_track_id: track.audio_track_id,
                audio_url: audioUrl,
                order_index: track.order_index,
                title: track.title,
                audio_track: track.audioTrack
                  ? {
                    id: track.audioTrack.id,
                    language_code: track.audioTrack.language_code,
                    audio_url: `${BASE_URL}/audio/${track.audioTrack.audio_url}`,
                    mime_type: track.audioTrack.mime_type,
                  }
                  : null,
              };
            }),
          },
          video: video
            ? {
              id: video.id,
              title: video.title,
              description: video.description,
              duration_ms: video.duration_ms,
              video_url: video.video_url,
              mime_type: video.mime_type,
              thumbnail_url: video.thumbnail_url,
              url: `${BASE_URL}/video/${video.video_url}`,
            }
            : null,
          telemetry: telemetry
            ? {
              id: telemetry.id,
              telemetry_url: telemetry.telemetry_url,
              version: telemetry.version,
              format: telemetry.format,
              url: `${BASE_URL}/telemetry/${telemetry.telemetry_url}`,
            }
            : null,
        };
      });
    }

    // VR & Chair devices (main session devices only — participants removed)
    const vrDevices = [];
    const chairDevices = [];

    if (plain.vr) {
      if (Array.isArray(plain.vr)) vrDevices.push(...plain.vr); else vrDevices.push(plain.vr);
    } else if (plain.vr_device_id) {
      const vr = await VRDevice.findByPk(plain.vr_device_id);
      if (vr) vrDevices.push(vr.toJSON ? vr.toJSON() : vr);
    } else {
      // derive from participants
      const parts = await SessionParticipant.findAll({
        where: { session_id: plain.id },
        include: [{ model: VRDevice, as: 'vr' }]
      });
      for (const p of parts) {
        const v = p.vr && (p.vr.toJSON ? p.vr.toJSON() : p.vr);
        if (v && !vrDevices.find(x => x.id === v.id)) vrDevices.push(v);
      }
    }

    if (plain.chair) {
      if (Array.isArray(plain.chair)) chairDevices.push(...plain.chair); else chairDevices.push(plain.chair);
    } else if (plain.chair_device_id) {
      const chair = await ChairDevice.findByPk(plain.chair_device_id);
      if (chair) chairDevices.push(chair.toJSON ? chair.toJSON() : chair);
    } else {
      // derive from participants
      const parts = await SessionParticipant.findAll({
        where: { session_id: plain.id },
        include: [{ model: ChairDevice, as: 'chair' }]
      });
      for (const p of parts) {
        const c = p.chair && (p.chair.toJSON ? p.chair.toJSON() : p.chair);
        if (c && !chairDevices.find(x => x.id === c.id)) chairDevices.push(c);
      }
    }

    return {
      statusCode: httpStatus.OK,
      response: {
        status: true,
        data: {
          ...plain,
          journeys: enrichedJourneys,
          vr: vrDevices,
          chair: chairDevices,
        },
      },
    };
  }


  commandSession({ sessionId, cmd, positionMs, durationMs }) {
    // Publish per-command topic to align with clients: sessions/<sessionId>/commands/<cmd>
    const topic = `sessions/${sessionId}/commands/${cmd}`;
    const applyAtMs = Date.now() + 1500; // small buffer for sync
    let payload;
    switch (cmd) {
      case 'start':
        payload = { cmd: 'start', startAtMs: applyAtMs, durationMs };
        break;
      case 'pause':
        payload = { cmd: 'pause', positionMs };
        break;
      case 'stop':
        payload = { cmd: 'stop' };
        break;
      case 'seek':
        payload = { cmd: 'seek', positionMs, applyAtMs };
        break;
      case 'sync':
        payload = { cmd: 'sync', serverTimeMs: Date.now() };
        break;
      default:
        return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Invalid cmd' } };
    }

    mqttService.publish(topic, payload, { qos: 1, retain: false });
    // Bridge fallback: mirror to Socket.IO so device HTML (bridge mode) receives it immediately
    try {
      global.io?.emit('mqtt_message', { topic, payload });
    } catch (e) { /* noop */ }
    return { statusCode: httpStatus.OK, response: { status: true, data: { topic, payload } } };
  }

  async updateSession(sessionId, payload) {
    const allowed = [
      'session_type',
      'journey_ids',
      'conducted_at',
      'total_participants',
      'video_view_count',
      'group_id',
      'status',
      'overall_status',
    ];
    const data = {};
    allowed.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(payload, k)) data[k] = payload[k];
    });

    const session = await Session.findByPk(sessionId);
    if (!session) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Session not found' } };
    }
    await session.update(data);
    return { statusCode: httpStatus.OK, response: { status: true, data: session } };
  }

  async updateOverallStatus(sessionId, status) {
    const allowed = ['on_going', 'completed'];
    if (!allowed.includes(status)) {
      return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Invalid status' } };
    }
    const session = await Session.findByPk(sessionId);
    if (!session) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Session not found' } };
    }
    await session.update({ overall_status: status });
    return { statusCode: httpStatus.OK, response: { status: true, data: session } };
  }

  // Delete a session and its participants
  async remove(sessionId) {
    const session = await Session.findByPk(sessionId);
    if (!session) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Session not found' } };
    }

    // Best-effort delete of participants first
    await SessionParticipant.destroy({ where: { session_id: sessionId } });
    await Session.destroy({ where: { id: sessionId } });

    return { statusCode: httpStatus.OK, response: { status: true, message: 'Session deleted' } };
  }
}

module.exports = SessionService;
