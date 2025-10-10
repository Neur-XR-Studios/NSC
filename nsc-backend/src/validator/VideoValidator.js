const Joi = require('joi');
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');

class VideoValidator {
  createValidator = async (req, res, next) => {
    const schema = Joi.object({
      title: Joi.string().required(),
      description: Joi.string().allow('', null),
      // duration_ms is computed server-side; allow but ignore
      mime_type: Joi.string().optional(),
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
      title: Joi.string().optional(),
      description: Joi.string().allow('', null).optional(),
      mime_type: Joi.string().optional(),
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

module.exports = VideoValidator;
