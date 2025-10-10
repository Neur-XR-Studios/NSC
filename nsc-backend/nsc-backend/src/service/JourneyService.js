const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');

const JourneyDao = require('../dao/JourneyDao');
// Reuse existing services to keep file handling consistent
const VideoService = require('./VideoService');
const AudioTrackService = require('./AudioTrackService');
const TelemetryService = require('./TelemetryService');

class JourneyService {
  constructor() {
    this.journeyDao = new JourneyDao();

    this.videoService = new VideoService();
    this.audioService = new AudioTrackService();
    this.telemetryService = new TelemetryService();
  }

  // Create a journey by linking single IDs (video required; audio/telemetry optional)
  create = async (body) => {
    try {
      const videoId = body.video_id;
      if (!videoId) return responseHandler.returnError(httpStatus.BAD_REQUEST, 'video_id is required');

      // Ensure video exists
      const video = await this.journeyDao.Model.sequelize.models.video.findOne({ where: { id: videoId } });
      if (!video) return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid video_id');

      // Validate optional single audio/telemetry
      let audio = null;
      let telemetry = null;
      const audioId = body.audio_track_id || body.audio_id; // accept either key
      if (audioId !== undefined && audioId !== null && audioId !== '') {
        audio = await this.journeyDao.Model.sequelize.models.audio_track.findOne({ where: { id: parseInt(audioId, 10) } });
        if (!audio) return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid audio_track_id');
      }
      const telemetryId = body.telemetry_id;
      if (telemetryId !== undefined && telemetryId !== null && telemetryId !== '') {
        telemetry = await this.journeyDao.Model.sequelize.models.telemetry.findOne({ where: { id: parseInt(telemetryId, 10) } });
        if (!telemetry) return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid telemetry_id');
      }

      // Create journey
      const journey = await this.journeyDao.create({
        title: body.journey_title || null,
        description: body.journey_description || null,
        video_id: videoId,
        audio_track_id: audio ? audio.id : null,
        telemetry_id: telemetry ? telemetry.id : null,
      });

      // Optional: multiple audio via existing audio_track IDs and/or raw URLs
      let audio_tracks = [];
      const JourneyAudioTrack = this.journeyDao.Model.sequelize.models.journey_audio_track;
      const AudioTrack = this.journeyDao.Model.sequelize.models.audio_track;
      const payloads = [];
      // From IDs (in given order)
      if (Array.isArray(body.audio_track_ids) && body.audio_track_ids.length) {
        for (let i = 0; i < body.audio_track_ids.length; i += 1) {
          const idVal = parseInt(body.audio_track_ids[i], 10);
          if (!Number.isNaN(idVal)) {
            const at = await AudioTrack.findOne({ where: { id: idVal } });
            if (at && at.audio_url) {
              payloads.push({ journey_id: journey.id, audio_track_id: idVal, audio_url: at.audio_url, order_index: payloads.length });
            }
          }
        }
      }
      // From raw URLs (append in order)
      if (Array.isArray(body.audio_urls) && body.audio_urls.length) {
        body.audio_urls
          .filter((u) => typeof u === 'string' && u !== '')
          .forEach((u) => payloads.push({ journey_id: journey.id, audio_url: u, order_index: payloads.length }));
      }
      if (payloads.length) {
        audio_tracks = await JourneyAudioTrack.bulkCreate(payloads);
      }

      // Aggregate response
      return responseHandler.returnSuccess(httpStatus.CREATED, 'Journey created', {
        journey,
        video,
        audio_track: audio,
        audio_tracks,
        telemetry,
      });
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  // Helpers removed: now 1:1 fields on journey

  list = async (page = 1, limit = 20) => {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (p - 1) * l;
    const result = await this.journeyDao.Model.findAndCountAll({
      limit: l,
      offset,
      order: [['id', 'DESC']],
    });

    const rows = await Promise.all(result.rows.map(async (j) => {
      const video = await this.journeyDao.Model.sequelize.models.video.findOne({ where: { id: j.video_id } });
      const audio = j.audio_track_id
        ? await this.journeyDao.Model.sequelize.models.audio_track.findOne({ where: { id: j.audio_track_id } })
        : null;
      const telemetry = j.telemetry_id
        ? await this.journeyDao.Model.sequelize.models.telemetry.findOne({ where: { id: j.telemetry_id } })
        : null;
      const JourneyAudioTrack = this.journeyDao.Model.sequelize.models.journey_audio_track;
      let audio_tracks = await JourneyAudioTrack.findAll({ where: { journey_id: j.id }, order: [['order_index', 'ASC'], ['id', 'ASC']] });
      // Derive audio_languages in the same order as audio_tracks
      let audio_languages = [];
      if (audio_tracks && audio_tracks.length) {
        const ids = audio_tracks.map((at) => at.audio_track_id).filter((v) => !!v);
        if (ids.length) {
          const AudioTrack = this.journeyDao.Model.sequelize.models.audio_track;
          const found = await AudioTrack.findAll({ where: { id: ids } });
          const byId = new Map(found.map((a) => [a.id, a]));
          const langs = [];
          audio_tracks = audio_tracks.map((at) => {
            const lang = at.audio_track_id && byId.get(at.audio_track_id) ? byId.get(at.audio_track_id).language_code : null;
            const plain = typeof at.toJSON === 'function' ? at.toJSON() : at;
            return { ...plain, language_code: lang || null };
          });
          // Unique language codes preserving order
          const seen = new Set();
          for (const at of audio_tracks) {
            if (at.language_code && !seen.has(at.language_code)) {
              seen.add(at.language_code);
              langs.push(at.language_code);
            }
          }
          audio_languages = langs;
        }
      }
      return { journey: j, video, audio_track: audio, audio_tracks, audio_languages, telemetry };
    }));

    return responseHandler.returnSuccess(httpStatus.OK, 'Journeys fetched', {
      total: result.count,
      page: p,
      limit: l,
      data: rows,
    });
  };

  getById = async (id) => {
    const journey = await this.journeyDao.findById(id);
    if (!journey) return responseHandler.returnError(httpStatus.NOT_FOUND, 'Journey not found');
    const video = await this.journeyDao.Model.sequelize.models.video.findOne({ where: { id: journey.video_id } });
    const audio = journey.audio_track_id
      ? await this.journeyDao.Model.sequelize.models.audio_track.findOne({ where: { id: journey.audio_track_id } })
      : null;
    const JourneyAudioTrack = this.journeyDao.Model.sequelize.models.journey_audio_track;
    let audio_tracks = await JourneyAudioTrack.findAll({ where: { journey_id: journey.id }, order: [['order_index', 'ASC'], ['id', 'ASC']] });
    // Derive audio_languages in the same order as audio_tracks
    let audio_languages = [];
    if (audio_tracks && audio_tracks.length) {
      const ids = audio_tracks.map((at) => at.audio_track_id).filter((v) => !!v);
      if (ids.length) {
        const AudioTrack = this.journeyDao.Model.sequelize.models.audio_track;
        const found = await AudioTrack.findAll({ where: { id: ids } });
        const byId = new Map(found.map((a) => [a.id, a]));
        const langs = [];
        audio_tracks = audio_tracks.map((at) => {
          const lang = at.audio_track_id && byId.get(at.audio_track_id) ? byId.get(at.audio_track_id).language_code : null;
          const plain = typeof at.toJSON === 'function' ? at.toJSON() : at;
          return { ...plain, language_code: lang || null };
        });
        // Unique language codes preserving order
        const seen = new Set();
        for (const at of audio_tracks) {
          if (at.language_code && !seen.has(at.language_code)) {
            seen.add(at.language_code);
            langs.push(at.language_code);
          }
        }
        audio_languages = langs;
      }
    }
    const telemetry = journey.telemetry_id
      ? await this.journeyDao.Model.sequelize.models.telemetry.findOne({ where: { id: journey.telemetry_id } })
      : null;
    return responseHandler.returnSuccess(httpStatus.OK, 'Journey fetched', { journey, video, audio_track: audio, audio_tracks, audio_languages, telemetry });
  };

  update = async (id, body) => {
    try {
      const journey = await this.journeyDao.findById(id);
      if (!journey) return responseHandler.returnError(httpStatus.NOT_FOUND, 'Journey not found');

      // Update journey meta
      const toUpdate = {};
      if (body.journey_title !== undefined) toUpdate.title = body.journey_title;
      if (body.journey_description !== undefined) toUpdate.description = body.journey_description;
      if (body.video_id !== undefined) {
        const video = await this.journeyDao.Model.sequelize.models.video.findOne({ where: { id: parseInt(body.video_id, 10) } });
        if (!video) return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid video_id');
        toUpdate.video_id = video.id;
      }
      if (body.audio_track_id !== undefined || body.audio_id !== undefined) {
        const aid = body.audio_track_id ?? body.audio_id;
        if (aid === null || aid === '' || aid === undefined) {
          toUpdate.audio_track_id = null;
        } else {
          const audio = await this.journeyDao.Model.sequelize.models.audio_track.findOne({ where: { id: parseInt(aid, 10) } });
          if (!audio) return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid audio_track_id');
          toUpdate.audio_track_id = audio.id;
        }
      }
      if (body.telemetry_id !== undefined) {
        const tid = body.telemetry_id;
        if (tid === null || tid === '' || tid === undefined) {
          toUpdate.telemetry_id = null;
        } else {
          const telemetry = await this.journeyDao.Model.sequelize.models.telemetry.findOne({ where: { id: parseInt(tid, 10) } });
          if (!telemetry) return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid telemetry_id');
          toUpdate.telemetry_id = telemetry.id;
        }
      }
      if (Object.keys(toUpdate).length) await this.journeyDao.updateById(toUpdate, id);

      // Replace per-journey audio tracks if provided (by ids and/or urls)
      if (Array.isArray(body.audio_urls) || Array.isArray(body.audio_track_ids)) {
        const JourneyAudioTrack = this.journeyDao.Model.sequelize.models.journey_audio_track;
        const AudioTrack = this.journeyDao.Model.sequelize.models.audio_track;
        // delete existing
        await JourneyAudioTrack.destroy({ where: { journey_id: id } });
        const payloads = [];
        if (Array.isArray(body.audio_track_ids) && body.audio_track_ids.length) {
          for (let i = 0; i < body.audio_track_ids.length; i += 1) {
            const idVal = parseInt(body.audio_track_ids[i], 10);
            if (!Number.isNaN(idVal)) {
              const at = await AudioTrack.findOne({ where: { id: idVal } });
              if (at && at.audio_url) {
                payloads.push({ journey_id: id, audio_track_id: idVal, audio_url: at.audio_url, order_index: payloads.length });
              }
            }
          }
        }
        if (Array.isArray(body.audio_urls) && body.audio_urls.length) {
          body.audio_urls
            .filter((u) => typeof u === 'string' && u !== '')
            .forEach((u) => payloads.push({ journey_id: id, audio_url: u, order_index: payloads.length }));
        }
        if (payloads.length) {
          await JourneyAudioTrack.bulkCreate(payloads);
        }
      }

      return this.getById(id);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  remove = async (id) => {
    try {
      const journey = await this.journeyDao.findById(id);
      if (!journey) return responseHandler.returnError(httpStatus.NOT_FOUND, 'Journey not found');
      await this.journeyDao.deleteByWhere({ id });

      return responseHandler.returnSuccess(httpStatus.OK, 'Journey deleted', {});
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };
}

module.exports = JourneyService;
