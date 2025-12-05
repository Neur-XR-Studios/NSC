const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { Session, VRDevice, ChairDevice, DevicePair, SessionParticipant, journey, JourneyAudioTrack } = require('../models');
const mqttService = require('./MqttService');
const logger = require('../config/logger');

class SessionService {
  /**
   * Check if devices are currently in an active session (by another operator)
   * @param {string} vrDeviceId - VR device ID to check
   * @param {string} chairDeviceId - Chair device ID to check
   * @param {number} excludeOperatorId - Operator ID to exclude from check (allow same operator to reuse)
   * @returns {Promise<Object|null>} Returns session info if devices are in use, null otherwise
   */
  async checkDevicesInActiveSession(vrDeviceId, chairDeviceId, excludeOperatorId = null) {
    // Find active sessions (on_going status) that use these devices
    const whereClause = {
      overall_status: 'on_going',
      [Op.or]: []
    };

    // Check both session-level device assignments and participant-level
    if (vrDeviceId) {
      whereClause[Op.or].push({ vr_device_id: vrDeviceId });
    }
    if (chairDeviceId) {
      whereClause[Op.or].push({ chair_device_id: chairDeviceId });
    }

    if (whereClause[Op.or].length === 0) return null;

    // Exclude sessions by the same operator (they can manage their own sessions)
    if (excludeOperatorId) {
      whereClause.operator_id = { [Op.ne]: excludeOperatorId };
    }

    const existingSession = await Session.findOne({
      where: whereClause,
      include: [
        { model: SessionParticipant, as: 'participants' }
      ]
    });

    if (existingSession) {
      return {
        sessionId: existingSession.id,
        operatorId: existingSession.operator_id,
        status: existingSession.status
      };
    }

    // Also check participants table for the devices
    const participantWhere = {
      [Op.or]: []
    };
    if (vrDeviceId) participantWhere[Op.or].push({ vr_device_id: vrDeviceId });
    if (chairDeviceId) participantWhere[Op.or].push({ chair_device_id: chairDeviceId });

    if (participantWhere[Op.or].length > 0) {
      const existingParticipant = await SessionParticipant.findOne({
        where: participantWhere,
        include: [{
          model: Session,
          as: 'session',
          where: {
            overall_status: 'on_going',
            ...(excludeOperatorId ? { operator_id: { [Op.ne]: excludeOperatorId } } : {})
          }
        }]
      });

      if (existingParticipant && existingParticipant.session) {
        return {
          sessionId: existingParticipant.session.id,
          operatorId: existingParticipant.session.operator_id,
          status: existingParticipant.session.status
        };
      }
    }

    return null;
  }

  /**
   * Get all devices currently in active sessions (for frontend to show "in session" status)
   * @param {number} excludeOperatorId - Operator ID to exclude (show only other operators' sessions)
   * @returns {Promise<Object>} { vrDeviceIds: string[], chairDeviceIds: string[] }
   */
  async getDevicesInActiveSessions(excludeOperatorId = null) {
    const whereClause = { overall_status: 'on_going' };
    if (excludeOperatorId) {
      whereClause.operator_id = { [Op.ne]: excludeOperatorId };
    }

    // Get devices from sessions table
    const sessions = await Session.findAll({
      where: whereClause,
      attributes: ['vr_device_id', 'chair_device_id'],
      include: [{
        model: SessionParticipant,
        as: 'participants',
        attributes: ['vr_device_id', 'chair_device_id']
      }]
    });

    const vrDeviceIds = new Set();
    const chairDeviceIds = new Set();

    sessions.forEach(s => {
      if (s.vr_device_id) vrDeviceIds.add(s.vr_device_id);
      if (s.chair_device_id) chairDeviceIds.add(s.chair_device_id);

      // Also add participant devices
      if (s.participants) {
        s.participants.forEach(p => {
          if (p.vr_device_id) vrDeviceIds.add(p.vr_device_id);
          if (p.chair_device_id) chairDeviceIds.add(p.chair_device_id);
        });
      }
    });

    return {
      vrDeviceIds: Array.from(vrDeviceIds),
      chairDeviceIds: Array.from(chairDeviceIds)
    };
  }

  async startSession({ vrDeviceId, chairDeviceId, journeyId, journeyIds, groupId, session_type, operatorId }) {
    const type = session_type === 'group' ? 'group' : 'individual';

    let vr = null;
    let chair = null;
    const errors = { missingFields: [], notFoundDevices: [], notFoundJourneys: [], devicesInUse: [] };
    const journeys = Array.isArray(journeyIds) ? journeyIds : (journeyId != null ? [journeyId] : []);

    if (type === 'individual') {
      if (!vrDeviceId) errors.missingFields.push('vrDeviceId');
      if (!chairDeviceId) errors.missingFields.push('chairDeviceId');
    }

    if (type === 'group' && journeys.length === 0) errors.missingFields.push('journeyIds');

    if (vrDeviceId) {
      // Try to find by primary key first, then by deviceId field
      vr = await VRDevice.findByPk(vrDeviceId) || await VRDevice.findOne({ where: { deviceId: vrDeviceId } });
      if (!vr) {
        errors.notFoundDevices.push(`VR: ${vrDeviceId}`);
        logger.warn(`[startSession] VR device not found: ${vrDeviceId}`);
      } else {
        logger.info(`[startSession] Found VR device: ${vr.id} (deviceId: ${vr.deviceId})`);
      }
    }
    if (chairDeviceId) {
      // Try to find by primary key first, then by deviceId field
      chair = await ChairDevice.findByPk(chairDeviceId) || await ChairDevice.findOne({ where: { deviceId: chairDeviceId } });
      if (!chair) {
        errors.notFoundDevices.push(`Chair: ${chairDeviceId}`);
        logger.warn(`[startSession] Chair device not found: ${chairDeviceId}`);
      } else {
        logger.info(`[startSession] Found Chair device: ${chair.id} (deviceId: ${chair.deviceId})`);
      }
    }

    // Check if devices are already in an active session by another operator
    if (vr || chair) {
      const inUse = await this.checkDevicesInActiveSession(
        vr ? vr.id : null,
        chair ? chair.id : null,
        operatorId
      );
      if (inUse) {
        errors.devicesInUse.push({
          message: 'One or more devices are already in an active session',
          sessionId: inUse.sessionId,
          operatorId: inUse.operatorId
        });
        logger.warn(`[startSession] Devices already in use by session ${inUse.sessionId}`);
      }
    }

    if (journeys.length > 0) {
      const found = await journey.findAll({ where: { id: { [Op.in]: journeys } }, attributes: ['id'] });
      const foundIds = new Set(found.map(j => j.id));
      journeys.forEach(id => { if (!foundIds.has(id)) errors.notFoundJourneys.push(id); });
    }

    if (errors.missingFields.length || errors.notFoundDevices.length || errors.notFoundJourneys.length || errors.devicesInUse.length) {
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
      operator_id: operatorId || null,
      vr_device_id: vr ? vr.id : null,
      chair_device_id: chair ? chair.id : null,
      status: 'ready',
      group_id: finalGroupId,
      journey_ids: journeys.length > 0 ? journeys : null,
      session_type: type,
    });

    // For individual sessions, also register the initial pair as a participant
    let initialParticipant = null;
    if (type === 'individual') {
      try {
        const participantData = {
          id: uuidv4(),
          session_id: session.id,
          vr_device_id: vr ? vr.id : null,
          chair_device_id: chair ? chair.id : null,
          language: null,
          joined_at: new Date(),
        };

        logger.info(`[startSession] Creating participant for individual session ${session.id}:`, {
          vrDeviceId: vrDeviceId,
          chairDeviceId: chairDeviceId,
          vrFound: !!vr,
          chairFound: !!chair,
          participantData
        });

        initialParticipant = await SessionParticipant.create(participantData);
        logger.info(`[startSession] Successfully created participant ${initialParticipant.id} for session ${session.id}`);
      } catch (e) {
        logger.error(`[startSession] Failed to create participant for session ${session.id}:`, e.message, e.stack);
        // Non-fatal: participant creation failure should not block session creation
      }
    }

    // Return session with participant for individual sessions
    const responseData = {
      ...session.toJSON(),
      participants: initialParticipant ? [initialParticipant.toJSON ? initialParticipant.toJSON() : initialParticipant] : [],
    };

    return { statusCode: httpStatus.OK, response: { status: true, data: responseData } };
  }

  /**
   * Start a session from a device pair ID
   * @param {Object} data - { pairId, journeyId?, journeyIds?, session_type? }
   * @returns {Promise<Object>}
   */
  async startSessionFromPair({ pairId, journeyId, journeyIds, session_type = 'individual' }) {
    if (!pairId) {
      return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'pairId is required' } };
    }

    // Find the device pair
    const pair = await DevicePair.findByPk(pairId, {
      include: [
        { model: VRDevice, as: 'vr' },
        { model: ChairDevice, as: 'chair' },
      ],
    });

    if (!pair) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Device pair not found' } };
    }

    if (!pair.is_active) {
      return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Device pair is inactive' } };
    }

    // Use the existing startSession method with the pair's device IDs
    return await this.startSession({
      vrDeviceId: pair.vr_device_id,
      chairDeviceId: pair.chair_device_id,
      journeyId,
      journeyIds,
      session_type,
    });
  }

  /**
   * Create a GROUP session with multiple participants (each participant maps VR+Chair)
   * payload: { members: [{ vrDeviceId, chairDeviceId, language? }], groupId?, journeyId?, journeyIds?, operatorId? }
   * If any running group session exists, pause it first (per rule).
   */
  async createGroupSession({ members = [], groupId, journeyId, journeyIds, operatorId }) {
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
      operator_id: operatorId || null,
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
      const firstJourneyId = journeys && journeys.length > 0 ? journeys[0] : null;

      for (const tgt of joinTargets) {
        // Include participant ID for this specific device pair
        const payload = {
          cmd: 'join_session',
          sessionId: session.id,
          sessionType: 'group',
          participantId: tgt.participantId,
          journeyId: firstJourneyId,
          timestamp: ts
        };
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
   * Create a GROUP session from multiple device pair IDs
   * @param {Object} data - { pairIds: string[], groupId?, journeyId?, journeyIds? }
   * @returns {Promise<Object>}
   */
  async createGroupSessionFromPairs({ pairIds = [], groupId, journeyId, journeyIds }) {
    if (!Array.isArray(pairIds) || pairIds.length === 0) {
      return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'pairIds array is required' } };
    }

    // Fetch all pairs
    const pairs = await DevicePair.findAll({
      where: { id: { [Op.in]: pairIds }, is_active: true },
      include: [
        { model: VRDevice, as: 'vr' },
        { model: ChairDevice, as: 'chair' },
      ],
    });

    if (pairs.length !== pairIds.length) {
      return {
        statusCode: httpStatus.BAD_REQUEST,
        response: { status: false, message: 'Some pairs not found or inactive' },
      };
    }

    // Convert pairs to members format for createGroupSession
    const members = pairs.map(pair => ({
      vrDeviceId: pair.vr_device_id,
      chairDeviceId: pair.chair_device_id,
      language: null,
    }));

    return await this.createGroupSession({ members, groupId, journeyId, journeyIds });
  }

  /**
   * Send a command to a session and persist session state updates
   */
  async commandAndUpdate({ sessionId, cmd, positionMs, durationMs, journeyId, language }) {
    const send = this.commandSession({ sessionId, cmd, positionMs, durationMs, journeyId, language });
    const result = await send;

    const session = await Session.findByPk(sessionId);
    if (session) {
      const now = new Date();
      const nowMs = Date.now();

      switch (cmd) {
        case 'start':
          // If resuming from pause, calculate pause duration
          let pauseDurationMs = session.pause_duration_ms || 0;
          if (session.paused_at && session.status === 'paused') {
            const pauseStart = new Date(session.paused_at).getTime();
            pauseDurationMs += (nowMs - pauseStart);
          }

          await session.update({
            status: 'running',
            start_time_ms: nowMs + 1500,
            last_command: 'start',
            started_at: session.started_at || now,
            paused_at: null,
            pause_duration_ms: pauseDurationMs,
          });
          break;

        case 'pause':
          await session.update({
            status: 'paused',
            last_command: 'pause',
            last_position_ms: positionMs ?? session.last_position_ms,
            paused_at: now,
          });
          break;

        case 'seek':
          await session.update({
            last_command: 'seek',
            last_position_ms: positionMs ?? session.last_position_ms,
          });
          break;

        case 'stop':
          // Calculate total duration
          let totalDurationMs = 0;
          if (session.started_at) {
            const startTime = new Date(session.started_at).getTime();
            totalDurationMs = nowMs - startTime - (session.pause_duration_ms || 0);
          }

          console.log('Stopping session', sessionId);
          await session.update({
            status: 'stopped',
            last_command: 'stop',
            overall_status: 'completed',
            stopped_at: now,
            total_duration_ms: totalDurationMs,
            last_position_ms: 0,  // Reset position on stop
          });
          break;

        case 'sync':
          await session.update({ last_command: 'sync' });
          break;

        case 'select_journey':
          await session.update({ last_command: 'select_journey' });
          break;

        default:
          break;
      }
    }

    return result;
  }

  async listSessions({ page = 1, limit = 20, status = 'on_going', operatorId = null }) {
    const offset = (Number(page) - 1) * Number(limit);
    const where = {};
    const BASE_URL = process.env.BASE_URL;

    if (status) {
      where.overall_status = status;
    }

    // Filter by operator if provided - this ensures session isolation per operator
    if (operatorId) {
      where.operator_id = operatorId;
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
        // Note: Do not include participants here to avoid huge eager loads; we'll fetch them below
      ],
    });

    if (!session) {
      return {
        statusCode: httpStatus.NOT_FOUND,
        response: { status: false, message: 'Session not found' },
      };
    }

    const BASE_URL = process.env.BASE_URL;
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

    // VR & Chair devices (main session devices only — participants handled below)
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

    // Fetch participants and attach (for Individual sessions UI to hydrate pairs)
    let participants = [];
    try {
      const rawParts = await SessionParticipant.findAll({
        where: { session_id: plain.id },
        include: [
          { model: VRDevice, as: 'vr' },
          { model: ChairDevice, as: 'chair' },
          // Note: currentJourney association might not exist, so we'll fetch journey separately if needed
        ],
        order: [['joined_at', 'ASC']],
      });
      participants = rawParts.map((p) => (p.toJSON ? p.toJSON() : p));
      logger.info(`[getById] Loaded ${participants.length} participants for session ${plain.id}`);
    } catch (e) {
      logger.warn(`[getById] Failed to load participants for session ${plain.id}:`, e.message);
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
          participants,
        },
      },
    };
  }


  commandSession({ sessionId, cmd, positionMs, durationMs, journeyId, language }) {
    // Publish per-command topic to align with clients: sessions/<sessionId>/commands/<cmd>
    const topic = `sessions/${sessionId}/commands/${cmd}`;
    const applyAtMs = Date.now() + 1500; // small buffer for sync
    let payload;
    switch (cmd) {
      case 'start':
        payload = { cmd: 'start', startAtMs: applyAtMs, positionMs, durationMs, journeyId };
        break;
      case 'pause':
        payload = { cmd: 'pause', positionMs, journeyId };
        break;
      case 'stop':
        console.log('Stopping session 364', sessionId);
        payload = { cmd: 'stop', journeyId };
        break;
      case 'seek':
        payload = { cmd: 'seek', positionMs, applyAtMs, journeyId };
        break;
      case 'sync':
        payload = { cmd: 'sync', serverTimeMs: Date.now(), positionMs, journeyId };
        break;
      case 'select_journey':
        payload = { cmd: 'select_journey', journeyId, language, applyAtMs };
        break;
      default:
        return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Invalid cmd' } };
    }

    mqttService.publish(topic, payload, { qos: 1, retain: false });
    // Bridge fallback: mirror to Socket.IO so device HTML (bridge mode) receives it immediately
    try {
      global.io?.emit('mqtt_message', { topic, payload });
    } catch (e) { /* noop */ }

    // Also mirror to each participant's device topics for compatibility with device subscribers
    // This is critical for Individual sessions where devices may only listen on devices/<hw>/commands/*
    try {
      const { SessionParticipant, VRDevice, ChairDevice } = require('../models');
      SessionParticipant.findAll({
        where: { session_id: sessionId },
        include: [
          { model: VRDevice, as: 'vr' },
          { model: ChairDevice, as: 'chair' },
        ],
      }).then((parts) => {
        if (!Array.isArray(parts) || parts.length === 0) return;
        for (const p of parts) {
          const vrHw = p?.vr?.deviceId || null;
          const chairHw = p?.chair?.deviceId || null;
          if (vrHw) {
            mqttService.publish(`devices/${vrHw}/commands/${cmd}`, { ...payload, sessionId }, { qos: 1, retain: false });
            try { global.io?.emit('mqtt_message', { topic: `devices/${vrHw}/commands/${cmd}`, payload: { ...payload, sessionId } }); } catch { /* noop */ }
          }
          if (chairHw) {
            mqttService.publish(`devices/${chairHw}/commands/${cmd}`, { ...payload, sessionId }, { qos: 1, retain: false });
            try { global.io?.emit('mqtt_message', { topic: `devices/${chairHw}/commands/${cmd}`, payload: { ...payload, sessionId } }); } catch { /* noop */ }
          }
        }
      }).catch(() => { /* noop */ });
    } catch (e) {
      // best-effort mirroring; do not fail the request
    }
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

  // Create a participant (VR + Chair) for a session and announce join_session
  async addParticipant(sessionId, { vrDeviceId, chairDeviceId, language }) {
    logger.info(`[addParticipant] Adding participant to session ${sessionId}: vr=${vrDeviceId}, chair=${chairDeviceId}, lang=${language}`);

    const errors = { missingFields: [], notFoundDevices: [] };
    if (!vrDeviceId) errors.missingFields.push('vrDeviceId');
    if (!chairDeviceId) errors.missingFields.push('chairDeviceId');

    const session = await Session.findByPk(sessionId);
    if (!session) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Session not found' } };
    }

    const vr = vrDeviceId ? await VRDevice.findByPk(vrDeviceId) || await VRDevice.findOne({ where: { deviceId: vrDeviceId } }) : null;
    const chair = chairDeviceId ? await ChairDevice.findByPk(chairDeviceId) || await ChairDevice.findOne({ where: { deviceId: chairDeviceId } }) : null;

    logger.info(`[addParticipant] Device lookup results: vr=${!!vr}, chair=${!!chair}`);

    if (!vr && vrDeviceId) {
      errors.notFoundDevices.push({ field: 'vrDeviceId', value: vrDeviceId });
      logger.warn(`[addParticipant] VR device not found: ${vrDeviceId}`);
    }
    if (!chair && chairDeviceId) {
      errors.notFoundDevices.push({ field: 'chairDeviceId', value: chairDeviceId });
      logger.warn(`[addParticipant] Chair device not found: ${chairDeviceId}`);
    }

    if (errors.missingFields.length || errors.notFoundDevices.length) {
      return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Validation failed', errors } };
    }

    const participantData = {
      id: uuidv4(),
      session_id: session.id,
      vr_device_id: vr.id,
      chair_device_id: chair.id,
      language: language || null,
      joined_at: new Date(),
    };

    logger.info(`[addParticipant] Creating participant:`, participantData);
    const participant = await SessionParticipant.create(participantData);
    logger.info(`[addParticipant] Successfully created participant ${participant.id}`);

    // Broadcast join_session to devices
    try {
      const ts = new Date().toISOString();
      // For individual: no journey initially (operator selects later), send null
      // For group: send first journey ID if available
      const journeyIds = session.journey_ids || [];
      const firstJourneyId = Array.isArray(journeyIds) && journeyIds.length > 0 ? journeyIds[0] : null;
      const payload = {
        cmd: 'join_session',
        sessionId: session.id,
        sessionType: session.session_type || 'individual',
        participantId: participant.id,
        journeyId: session.session_type === 'individual' ? null : firstJourneyId,
        timestamp: ts
      };
      if (vr?.deviceId) mqttService.publish(`devices/${vr.deviceId}/commands/join_session`, payload, { qos: 1, retain: false });
      if (chair?.deviceId) mqttService.publish(`devices/${chair.deviceId}/commands/join_session`, payload, { qos: 1, retain: false });
      try { if (vr?.deviceId) global.io?.emit('mqtt_message', { topic: `devices/${vr.deviceId}/commands/join_session`, payload }); } catch { /* noop */ }
      try { if (chair?.deviceId) global.io?.emit('mqtt_message', { topic: `devices/${chair.deviceId}/commands/join_session`, payload }); } catch { /* noop */ }
    } catch { /* noop */ }

    return { statusCode: httpStatus.OK, response: { status: true, data: participant } };
  }

  // Remove participant and send leave_session to devices
  async removeParticipant(sessionId, participantId) {
    const participant = await SessionParticipant.findByPk(participantId, { include: [{ model: VRDevice, as: 'vr' }, { model: ChairDevice, as: 'chair' }] });
    if (!participant || participant.session_id !== sessionId) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Participant not found' } };
    }
    await SessionParticipant.destroy({ where: { id: participantId } });
    try {
      const payload = { cmd: 'leave_session', sessionId };
      const vrHw = participant.vr?.deviceId || null;
      const chairHw = participant.chair?.deviceId || null;
      if (vrHw) mqttService.publish(`devices/${vrHw}/commands/leave_session`, payload, { qos: 1, retain: false });
      if (chairHw) mqttService.publish(`devices/${chairHw}/commands/leave_session`, payload, { qos: 1, retain: false });
      try { if (vrHw) global.io?.emit('mqtt_message', { topic: `devices/${vrHw}/commands/leave_session`, payload }); } catch { }
      try { if (chairHw) global.io?.emit('mqtt_message', { topic: `devices/${chairHw}/commands/leave_session`, payload }); } catch { }
    } catch { /* noop */ }
    return { statusCode: httpStatus.OK, response: { status: true, message: 'Participant removed' } };
  }

  // Participant-scoped command
  async commandParticipant({ sessionId, participantId, cmd, positionMs, durationMs, journeyId, language }) {
    const participant = await SessionParticipant.findByPk(participantId, { include: [{ model: VRDevice, as: 'vr' }, { model: ChairDevice, as: 'chair' }] });
    if (!participant || participant.session_id !== sessionId) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Participant not found' } };
    }

    // Publish participant topic
    const topic = `sessions/${sessionId}/participants/${participantId}/commands/${cmd}`;
    const applyAtMs = Date.now() + 1500;
    let payload;
    switch (cmd) {
      case 'start':
        payload = { cmd: 'start', startAtMs: applyAtMs, positionMs, durationMs, journeyId };
        break;
      case 'pause':
        payload = { cmd: 'pause', positionMs, journeyId };
        break;
      case 'stop':
        console.log('Stopping participant 844', sessionId);
        payload = { cmd: 'stop', journeyId };
        break;
      case 'seek':
        payload = { cmd: 'seek', positionMs, applyAtMs, journeyId };
        break;
      case 'sync':
        payload = { cmd: 'sync', serverTimeMs: Date.now(), positionMs, journeyId };
        break;
      case 'select_journey':
        payload = { cmd: 'select_journey', journeyId, language: language || '', applyAtMs };
        break;
      default:
        return { statusCode: httpStatus.BAD_REQUEST, response: { status: false, message: 'Invalid cmd' } };
    }

    mqttService.publish(topic, payload, { qos: 1, retain: false });
    try { global.io?.emit('mqtt_message', { topic, payload }); } catch { }

    // Mirror to both device topics for compatibility
    // Use participant.vr_device_id directly (the stored device ID) OR fall back to associated model
    const vrHw = participant.vr_device_id || participant.vr?.deviceId || null;
    const chairHw = participant.chair_device_id || participant.chair?.deviceId || null;
    const logger = require('../config/logger');
    logger.info(`[commandParticipant] ${cmd} for participant ${participantId} (VR: ${vrHw}, Chair: ${chairHw}) ${cmd === 'select_journey' ? `journey: ${journeyId}` : ''}`);
    try {
      if (vrHw) {
        mqttService.publish(`devices/${vrHw}/commands/${cmd}`, { ...payload, sessionId }, { qos: 1, retain: false });
        try { global.io?.emit('mqtt_message', { topic: `devices/${vrHw}/commands/${cmd}`, payload: { ...payload, sessionId } }); } catch { }
        logger.info(`[commandParticipant] Published to devices/${vrHw}/commands/${cmd}`);
      }
      if (chairHw) {
        mqttService.publish(`devices/${chairHw}/commands/${cmd}`, { ...payload, sessionId }, { qos: 1, retain: false });
        try { global.io?.emit('mqtt_message', { topic: `devices/${chairHw}/commands/${cmd}`, payload: { ...payload, sessionId } }); } catch { }
        logger.info(`[commandParticipant] Published to devices/${chairHw}/commands/${cmd}`);
      }
    } catch { /* noop */ }

    // Persist participant's current journey selection and language if applicable
    if (cmd === 'select_journey' && journeyId != null) {
      try {
        const updateData = { current_journey_id: journeyId };
        if (language) {
          updateData.language = language;
        }
        await participant.update(updateData);
        logger.info(`[commandParticipant] Updated participant ${participantId} journey: ${journeyId}, language: ${language || 'unchanged'}`);
      } catch (e) {
        logger.warn(`[commandParticipant] Failed to update participant ${participantId}:`, e.message);
      }
    }

    return { statusCode: httpStatus.OK, response: { status: true, data: { topic, payload } } };
  }

  /**
   * Get all active sessions (for session persistence/restoration)
   * @param {string} sessionType - Optional filter: 'individual' or 'group'
   * @param {number} operatorId - Optional operator ID for session isolation
   * @returns {Promise<Object>}
   */
  async getActiveSessions(sessionType = null, operatorId = null) {
    const where = { is_active: true };
    if (sessionType) {
      where.session_type = sessionType;
    }
    // Filter by operator if provided - this ensures session isolation per operator
    if (operatorId) {
      where.operator_id = operatorId;
    }

    const sessions = await Session.findAll({
      where,
      include: [
        { model: VRDevice, as: 'vr' },
        { model: ChairDevice, as: 'chair' },
        {
          model: SessionParticipant, as: 'participants', include: [
            { model: VRDevice, as: 'vr' },
            { model: ChairDevice, as: 'chair' }
          ]
        },
      ],
      order: [['last_activity', 'DESC']],
    });

    return {
      statusCode: httpStatus.OK,
      response: {
        status: true,
        data: sessions.map(s => s.toJSON ? s.toJSON() : s),
      },
    };
  }

  /**
   * Unpair/deactivate a session (mark as inactive instead of deleting)
   * @param {string} sessionId
   * @returns {Promise<Object>}
   */
  async unpairSession(sessionId) {
    const session = await Session.findByPk(sessionId);
    if (!session) {
      return { statusCode: httpStatus.NOT_FOUND, response: { status: false, message: 'Session not found' } };
    }

    // Mark session as inactive
    await session.update({
      is_active: false,
      status: 'stopped',
      overall_status: 'completed',
      stopped_at: new Date(),
    });

    // Send stop command to all participants
    try {
      const participants = await SessionParticipant.findAll({
        where: { session_id: sessionId },
        include: [
          { model: VRDevice, as: 'vr' },
          { model: ChairDevice, as: 'chair' }
        ],
      });

      const payload = { cmd: 'stop', sessionId };
      for (const p of participants) {
        const vrHw = p.vr?.deviceId || null;
        const chairHw = p.chair?.deviceId || null;
        if (vrHw) {
          mqttService.publish(`devices/${vrHw}/commands/stop`, payload, { qos: 1, retain: false });
          try { global.io?.emit('mqtt_message', { topic: `devices/${vrHw}/commands/stop`, payload }); } catch { }
        }
        if (chairHw) {
          mqttService.publish(`devices/${chairHw}/commands/stop`, payload, { qos: 1, retain: false });
          try { global.io?.emit('mqtt_message', { topic: `devices/${chairHw}/commands/stop`, payload }); } catch { }
        }
      }
    } catch (e) {
      logger.warn(`[unpairSession] Failed to send stop commands for session ${sessionId}:`, e.message);
    }

    return { statusCode: httpStatus.OK, response: { status: true, message: 'Session unpaired successfully' } };
  }

  /**
   * Update last_activity timestamp for a session
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async updateActivity(sessionId) {
    try {
      await Session.update(
        { last_activity: new Date() },
        { where: { id: sessionId } }
      );
    } catch (e) {
      logger.warn(`[updateActivity] Failed to update activity for session ${sessionId}:`, e.message);
    }
  }
}

module.exports = SessionService;
