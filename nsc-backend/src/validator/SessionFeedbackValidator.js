const Joi = require('joi');

class SessionFeedbackValidator {
    static createSchema = Joi.object({
        session_id: Joi.string().uuid().required().messages({
            'string.base': 'Session ID must be a string',
            'string.uuid': 'Session ID must be a valid UUID',
            'any.required': 'Session ID is required',
        }),
        rating: Joi.number().integer().min(1).max(5).required().messages({
            'number.base': 'Rating must be a number',
            'number.integer': 'Rating must be an integer',
            'number.min': 'Rating must be at least 1',
            'number.max': 'Rating must be at most 5',
            'any.required': 'Rating is required',
        }),
        feedback_text: Joi.string().max(500).allow('', null).optional().messages({
            'string.base': 'Feedback text must be a string',
            'string.max': 'Feedback text must not exceed 500 characters',
        }),
    });

    static listSchema = Joi.object({
        page: Joi.number().integer().min(1).optional().messages({
            'number.base': 'Page must be a number',
            'number.integer': 'Page must be an integer',
            'number.min': 'Page must be at least 1',
        }),
        limit: Joi.number().integer().min(1).max(100).optional().messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit must be at most 100',
        }),
        search: Joi.string().allow('').optional().messages({
            'string.base': 'Search must be a string',
        }),
    });

    static sessionIdSchema = Joi.object({
        sessionId: Joi.string().uuid().required().messages({
            'string.base': 'Session ID must be a string',
            'string.uuid': 'Session ID must be a valid UUID',
            'any.required': 'Session ID is required',
        }),
    });

    static validate = (schema) => {
        return (req, res, next) => {
            const dataToValidate = schema === SessionFeedbackValidator.sessionIdSchema ? req.params :
                schema === SessionFeedbackValidator.createSchema ? req.body :
                    req.query;

            const { error, value } = schema.validate(dataToValidate, { abortEarly: false });

            if (error) {
                const errorMessages = error.details.map((detail) => detail.message);
                return res.status(400).json({
                    status: false,
                    message: 'Validation error',
                    errors: errorMessages,
                });
            }

            // Replace req data with validated data
            if (schema === SessionFeedbackValidator.sessionIdSchema) {
                req.params = value;
            } else if (schema === SessionFeedbackValidator.createSchema) {
                req.body = value;
            } else {
                req.query = value;
            }

            next();
        };
    };
}

module.exports = SessionFeedbackValidator;
