const httpStatus = require('http-status');
const SessionService = require('../service/SessionService');
const logger = require('../config/logger');

class SessionController {
  constructor() {
    this.service = new SessionService();
  }

  start = async (req, res) => {
    try {
      // Pass operator ID from authenticated user for session isolation
      const operatorId = req.user?.id || null;
      const result = await this.service.startSession({ ...req.body, operatorId });
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Create a participant in a session
  addParticipant = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await this.service.addParticipant(sessionId, req.body || {});
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Remove a participant from a session
  removeParticipant = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const participantId = req.params.pid;
      const result = await this.service.removeParticipant(sessionId, participantId);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Send a command to a specific participant
  commandParticipant = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const participantId = req.params.pid;
      const result = await this.service.commandParticipant({ sessionId, participantId, ...req.body });
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Retrieve a single session by ID
  getById = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await this.service.getById(sessionId);

      // Add file URLs similar to JourneyController
      if (result && result.response && result.response.status && result.response.data) {
        const data = result.response.data;
        this.addFileUrls(data, req);
      }

      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Retrieve sessions with optional overall_status filter (default on_going)
  // Sessions are filtered by operator_id to ensure isolation between operators
  list = async (req, res) => {
    try {
      const { page, limit, status = 'on_going' } = req.query;
      // Pass operator ID from authenticated user for session isolation
      const operatorId = req.user?.id || null;
      const result = await this.service.listSessions({ page, limit, status, operatorId });

      // Add file URLs similar to JourneyController
      if (result && result.response && result.response.status && result.response.data) {
        const data = result.response.data;
        if (Array.isArray(data.data)) {
          data.data = data.data.map(session => {
            this.addFileUrls(session, req);
            return session;
          });
        }
      }

      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Create a GROUP session with participants
  createGroup = async (req, res) => {
    try {
      // Pass operator ID from authenticated user for session isolation
      const operatorId = req.user?.id || null;
      const result = await this.service.createGroupSession({ ...req.body, operatorId });
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Start session from device pair ID
  startFromPair = async (req, res) => {
    try {
      const result = await this.service.startSessionFromPair(req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Create group session from device pair IDs
  createGroupFromPairs = async (req, res) => {
    try {
      const result = await this.service.createGroupSessionFromPairs(req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Send a command to a session and persist updates
  command = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await this.service.commandAndUpdate({ sessionId, ...req.body });
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  update = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await this.service.updateSession(sessionId, req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Update only overall status via PATCH
  updateStatus = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { status } = req.body;
      const result = await this.service.updateOverallStatus(sessionId, status);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Delete a session and its participants
  remove = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await this.service.remove(sessionId);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Add file URLs to session data (similar to JourneyController)
  addFileUrls = (data, req) => {
    try {
      const base = `${req.protocol}://${req.get('host')}`;
      if (Array.isArray(data.journeys)) {
        data.journeys = data.journeys.map(journeyData => {
          const journeyItem = { ...journeyData };

          // Add URLs to video
          if (journeyItem.video) {
            const v = journeyItem.video;
            const fallbackThumb = v?.video_url ? `${v.video_url.replace(/\.[^/.]+$/, '')}.jpg` : null;
            const thumbFile = v?.thumbnail_url || fallbackThumb;
            journeyItem.video = {
              ...v,
              url: v?.video_url ? `${base}/video/${v.video_url}` : null,
              thumbnail_url: thumbFile ? `${base}/thumbnails/${thumbFile}` : null,
            };
          }

          // Add URLs to audio tracks
          if (Array.isArray(journeyItem.audio_tracks)) {
            journeyItem.audio_tracks = journeyItem.audio_tracks.map((a) => {
              const at = a;
              return {
                ...at,
                url: at?.audio_url ? `${base}/audio/${at.audio_url}` : null,
              };
            });
          }

          // Add URLs to telemetry
          if (journeyItem.telemetry) {
            const t = journeyItem.telemetry;
            journeyItem.telemetry = {
              ...t,
              url: t?.telemetry_url ? `${base}/telemetry/${t.telemetry_url}` : null,
            };
          }

          return journeyItem;
        });
      }
    } catch (error) {
      logger.warn('Error adding file URLs to session data:', error.message);
    }
  };

  // Get all active sessions (for session persistence)
  // Sessions are filtered by operator_id to ensure isolation between operators
  getActiveSessions = async (req, res) => {
    try {
      const { sessionType } = req.query;
      // Pass operator ID from authenticated user for session isolation
      const operatorId = req.user?.id || null;
      const result = await this.service.getActiveSessions(sessionType, operatorId);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Unpair/deactivate a session
  unpairSession = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await this.service.unpairSession(sessionId);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // Get devices currently in active sessions (for showing "in session" status)
  // Excludes current operator's sessions so they can manage their own devices
  getDevicesInSession = async (req, res) => {
    try {
      const operatorId = req.user?.id || null;
      const result = await this.service.getDevicesInActiveSessions(operatorId);
      return res.status(httpStatus.OK).send({ status: true, data: result });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // ============ DEVICE-FACING ENDPOINTS (No Auth Required) ============
  // These endpoints are for VR/Chair devices that don't have user authentication

  // Get session by ID - for VR devices (no auth, no operator filtering)
  getByIdForDevice = async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await this.service.getById(sessionId);

      // Add file URLs similar to JourneyController
      if (result && result.response && result.response.status && result.response.data) {
        const data = result.response.data;
        this.addFileUrls(data, req);
      }

      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  // List sessions - for VR devices (no auth, no operator filtering)
  // Returns all active sessions without operator isolation
  listForDevice = async (req, res) => {
    try {
      const { page, limit, status = 'on_going' } = req.query;
      // No operator filtering for device endpoints
      const result = await this.service.listSessions({ page, limit, status, operatorId: null });

      // Add file URLs similar to JourneyController
      if (result && result.response && result.response.status && result.response.data) {
        const data = result.response.data;
        if (Array.isArray(data.data)) {
          data.data = data.data.map(session => {
            this.addFileUrls(session, req);
            return session;
          });
        }
      }

      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };
}

module.exports = SessionController;
