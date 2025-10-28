const httpStatus = require('http-status');
const JourneyService = require('../service/JourneyService');
const logger = require('../config/logger');

class JourneyController {
  constructor() {
    this.service = new JourneyService();
  }

  // POST /api/journeys (IDs only)
  create = async (req, res) => {
    try {
      const result = await this.service.create(req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // GET /api/journeys/:id
  get = async (req, res) => {
    try {
      const result = await this.service.getById(req.params.id);
      // Attach absolute URLs
      try {
        const base = `${req.protocol}://${req.get('host')}`;
        if (result && result.response && result.response.status && result.response.data) {
          const data = result.response.data;
          const out = { ...data };
          if (data.video) {
            const v = typeof data.video.toJSON === 'function' ? data.video.toJSON() : data.video;
            const fallbackThumb = v?.video_url ? `${v.video_url.replace(/\.[^/.]+$/, '')}.jpg` : null;
            const thumbFile = v?.thumbnail_url || fallbackThumb;
            out.video = {
              ...v,
              url: v?.video_url ? `${base}/video/${v.video_url}` : null,
              thumbnail_url: thumbFile ? `${base}/thumbnails/${thumbFile}` : null,
            };
          }
          if (data.audio_track) {
            const a = typeof data.audio_track.toJSON === 'function' ? data.audio_track.toJSON() : data.audio_track;
            out.audio_track = {
              ...a,
              url: a?.audio_url ? `${base}/audio/${a.audio_url}` : null,
            };
          }
          // Map multiple per-journey audio tracks if present
          if (Array.isArray(data.audio_tracks)) {
            out.audio_tracks = data.audio_tracks.map((a) => {
              const at = typeof a.toJSON === 'function' ? a.toJSON() : a;
              return {
                ...at,
                url: at?.audio_url ? `${base}/audio/${at.audio_url}` : null,
              };
            });
          }
          // Ensure languages arrays are present for clients that need only languages
          if (Array.isArray(data.audio_languages)) {
            out.audio_languages = data.audio_languages;
            out.languages = data.audio_languages;
          }
          if (data.telemetry) {
            const t = typeof data.telemetry.toJSON === 'function' ? data.telemetry.toJSON() : data.telemetry;
            out.telemetry = {
              ...t,
              url: t?.telemetry_url ? `${base}/telemetry/${t.telemetry_url}` : null,
            };
          }
          result.response.data = out;
        }
      } catch (mapErr) {
        logger.warn ? logger.warn(mapErr.message) : logger.error(mapErr);
      }
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // GET /api/journeys
  list = async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.service.list(page, limit);
      // Attach absolute URLs and optional thumbnails if present
      try {
        const base = `${req.protocol}://${req.get('host')}`;
        if (
          result &&
          result.response &&
          result.response.status &&
          result.response.data &&
          Array.isArray(result.response.data.data)
        ) {
          result.response.data.data = result.response.data.data.map((row) => {
            const r = { ...row };
            if (r.video) {
              const v = r.video && typeof r.video.toJSON === 'function' ? r.video.toJSON() : r.video;
              const fallbackThumb = v?.video_url ? `${v.video_url.replace(/\.[^/.]+$/, '')}.jpg` : null;
              const thumbFile = v?.thumbnail_url || fallbackThumb;
              r.video = {
                ...v,
                url: v?.video_url ? `${base}/video/${v.video_url}` : null,
                thumbnail_url: thumbFile ? `${base}/thumbnails/${thumbFile}` : null,
              };
            }
            if (r.audio_track) {
              const a = r.audio_track && typeof r.audio_track.toJSON === 'function' ? r.audio_track.toJSON() : r.audio_track;
              r.audio_track = {
                ...a,
                url: a?.audio_url ? `${base}/audio/${a.audio_url}` : null,
              };
            }
            // Map multiple per-journey audio tracks if present
            if (Array.isArray(r.audio_tracks)) {
              r.audio_tracks = r.audio_tracks.map((a) => {
                const at = a && typeof a.toJSON === 'function' ? a.toJSON() : a;
                return {
                  ...at,
                  url: at?.audio_url ? `${base}/audio/${at.audio_url}` : null,
                };
              });
            }
            // Ensure languages arrays are present
            if (Array.isArray(r.audio_languages)) {
              r.languages = r.audio_languages;
            }
            if (r.telemetry) {
              const t = r.telemetry && typeof r.telemetry.toJSON === 'function' ? r.telemetry.toJSON() : r.telemetry;
              r.telemetry = {
                ...t,
                url: t?.telemetry_url ? `${base}/telemetry/${t.telemetry_url}` : null,
              };
            }
            return r;
          });
        }
      } catch (mapErr) {
        logger.warn ? logger.warn(mapErr.message) : logger.error(mapErr);
      }
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // PATCH /api/journeys/:id (IDs only)
  update = async (req, res) => {
    try {
      const result = await this.service.update(req.params.id, req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // DELETE /api/journeys/:id (unlink-only)
  remove = async (req, res) => {
    try {
      const result = await this.service.remove(req.params.id);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  languages = async (req, res) => {
    try {
      const result = await this.service.getById(req.params.id);
      if (!result || !result.response || !result.response.status) {
        return res.status(result?.statusCode || httpStatus.NOT_FOUND).send(result?.response || { status: false, message: 'Journey not found' });
      }
      const data = result.response.data;
      const languages = Array.isArray(data?.audio_languages) ? data.audio_languages : [];
      return res.status(httpStatus.OK).send({ status: true, data: { journey_id: data?.journey?.id || req.params.id, languages } });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // GET /api/journeys/vr - simplified payload for VR clients
  listForVr = async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const result = await this.service.list(page, limit);
      const base = `${req.protocol}://${req.get('host')}`;
      let data = [];
      if (result?.response?.status && Array.isArray(result.response.data?.data)) {
        data = result.response.data.data.map((row) => {
          const j = row.journey && typeof row.journey.toJSON === 'function' ? row.journey.toJSON() : row.journey;
          const vRaw = row.video && typeof row.video.toJSON === 'function' ? row.video.toJSON() : row.video;
          const aRaw = row.audio_track && typeof row.audio_track.toJSON === 'function' ? row.audio_track.toJSON() : row.audio_track;
          const tRaw = row.telemetry && typeof row.telemetry.toJSON === 'function' ? row.telemetry.toJSON() : row.telemetry;

          const video = vRaw
            ? {
              ...vRaw,
              url: vRaw.video_url ? `${base}/video/${vRaw.video_url}` : null,
              thumbnail_url: (() => {
                const fallback = vRaw.video_url ? `${vRaw.video_url.replace(/\.[^/.]+$/, '')}.jpg` : null;
                const file = vRaw.thumbnail_url || fallback;
                return file ? `${base}/thumbnails/${file}` : null;
              })(),
            }
            : null;

          // Backward compat single audio
          const audio = aRaw
            ? {
              ...aRaw,
              url: aRaw.audio_url ? `${base}/audio/${aRaw.audio_url}` : null,
            }
            : null;

          // New: multiple audio tracks array
          let audio_tracks = [];
          if (Array.isArray(row.audio_tracks)) {
            audio_tracks = row.audio_tracks.map((a) => {
              const at = a && typeof a.toJSON === 'function' ? a.toJSON() : a;
              return {
                ...at,
                url: at.audio_url ? `${base}/audio/${at.audio_url}` : null,
              };
            });
          }

          const telemetry = tRaw
            ? {
              ...tRaw,
              url: tRaw.telemetry_url ? `${base}/telemetry/${tRaw.telemetry_url}` : null,
            }
            : null;

          return {
            id: j?.id,
            title: j?.title,
            description: j?.description,
            video,
            audio,
            audio_tracks,
            audio_languages: Array.isArray(row.audio_languages) ? row.audio_languages : [],
            telemetry,
          };
        });
      }
      return res.status(httpStatus.OK).send({ status: true, message: 'VR journeys', data });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };
}

module.exports = JourneyController;
