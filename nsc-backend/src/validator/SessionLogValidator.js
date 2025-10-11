const Joi = require('joi');
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');

class SessionLogValidator {
  createValidator = async (req, res, next) => {
    const schema = Joi.object({
      session_id: Joi.string().uuid({ version: 'uuidv4' }).required(),
      event: Joi.string().max(64).required(),
      journey_id: Joi.number().integer().optional(),
      start_time: Joi.date().optional(),
      end_time: Joi.date().optional(),
      duration_ms: Joi.number().integer().min(0).optional(),
      vr_device_id: Joi.string().max(32).optional(),
      position_ms: Joi.number().integer().min(0).optional(),
      error_code: Joi.string().max(64).optional(),
      error_message: Joi.string().allow('', null).optional(),
      details: Joi.object().unknown(true).optional(),
      metadata: Joi.object().unknown(true).optional(),
    });
    const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
    const { error, value } = schema.validate(req.body, options);
    if (error) {
      const errorMessage = error.details.map((d) => d.message).join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }
    req.body = value;
    return next();
  };

  updateValidator = async (req, res, next) => {
    const schema = Joi.object({
      event: Joi.string().max(64).optional(),
      journey_id: Joi.number().integer().optional(),
      start_time: Joi.date().optional(),
      end_time: Joi.date().optional(),
      duration_ms: Joi.number().integer().min(0).optional(),
      vr_device_id: Joi.string().max(32).optional(),
      position_ms: Joi.number().integer().min(0).optional(),
      error_code: Joi.string().max(64).optional(),
      error_message: Joi.string().allow('', null).optional(),
      details: Joi.object().unknown(true).optional(),
      metadata: Joi.object().unknown(true).optional(),
    });
    const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
    const { error, value } = schema.validate(req.body, options);
    if (error) {
      const errorMessage = error.details.map((d) => d.message).join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }
    req.body = value;
    return next();
  };
}

module.exports = SessionLogValidator;
