const Joi = require('joi');
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');

class TelemetryValidator {
  createValidator = async (req, res, next) => {
    const schema = Joi.object({
      video_id: Joi.number().integer().allow(null).optional(),
      version: Joi.string().optional(),
      format: Joi.string().optional(),
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
      video_id: Joi.number().integer().allow(null).optional(),
      version: Joi.string().optional(),
      format: Joi.string().optional(),
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

module.exports = TelemetryValidator;
