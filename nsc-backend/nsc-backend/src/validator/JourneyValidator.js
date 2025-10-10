const Joi = require('joi');

class JourneyValidator {
  createValidator = async (req, res, next) => {
    const schema = Joi.object({
      video_id: Joi.number().integer().required(),
      journey_title: Joi.string().allow('', null),
      journey_description: Joi.string().allow('', null),
      // Single optional links
      audio_track_id: Joi.number().integer().allow(null),
      audio_id: Joi.number().integer().allow(null), // alias supported
      telemetry_id: Joi.number().integer().allow(null),
      // Multiple audio URLs for per-journey tracks
      audio_urls: Joi.array().items(Joi.string().allow('').uri()).optional(),
      // Or multiple existing audio track IDs
      audio_track_ids: Joi.array().items(Joi.number().integer()).optional(),
    });
    const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
    const { error, value } = schema.validate(req.body, options);
    if (error) return res.status(400).send({ code: 400, message: error.details.map((d) => d.message).join(', ') });
    req.body = value;
    next();
  };

  updateValidator = async (req, res, next) => {
    const schema = Joi.object({
      video_id: Joi.number().integer().optional(),
      journey_title: Joi.string().allow('', null).optional(),
      journey_description: Joi.string().allow('', null).optional(),
      // Direct set/clear of optional single links
      audio_track_id: Joi.alternatives().try(Joi.number().integer(), Joi.valid('', null)),
      audio_id: Joi.alternatives().try(Joi.number().integer(), Joi.valid('', null)),
      telemetry_id: Joi.alternatives().try(Joi.number().integer(), Joi.valid('', null)),
      // Replace all per-journey audio URLs
      audio_urls: Joi.array().items(Joi.string().allow('').uri()).optional(),
      // Or replace using IDs
      audio_track_ids: Joi.array().items(Joi.number().integer()).optional(),
    });
    const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
    const { error, value } = schema.validate(req.body, options);
    if (error) return res.status(400).send({ code: 400, message: error.details.map((d) => d.message).join(', ') });
    req.body = value;
    next();
  };
}

module.exports = JourneyValidator;
