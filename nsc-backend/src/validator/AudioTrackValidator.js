const Joi = require('joi');
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');

class AudioTrackValidator {
  createValidator = async (req, res, next) => {
    const schema = Joi.object({
      language_code: Joi.string().min(2).max(10).allow('', null),
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
      language_code: Joi.string().min(2).max(10).allow('', null).optional(),
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

module.exports = AudioTrackValidator;
