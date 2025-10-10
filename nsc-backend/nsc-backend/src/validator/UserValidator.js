const Joi = require('joi');
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');

class UserValidator {
    // Standard validators following the same pattern as other modules
    createValidator = async (req, res, next) => {
        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(6).required(),
            first_name: Joi.string().allow('', null),
            last_name: Joi.string().allow('', null),
            role: Joi.string().valid('admin', 'user').default('user'),
            status: Joi.number().valid(0, 1, 2).optional(),
            address: Joi.string().allow('', null),
            phone_number: Joi.string().allow('', null),
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
            first_name: Joi.string().allow('', null),
            last_name: Joi.string().allow('', null),
            email: Joi.string().email().optional(),
            password: Joi.string().min(6).optional(),
            address: Joi.string().allow('', null),
            phone_number: Joi.string().allow('', null),
            status: Joi.number().valid(0, 1, 2).optional(),
            role: Joi.string().valid('admin', 'user').optional(), // Now allowed in main update
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

    updateProfileValidator = async (req, res, next) => {
        const schema = Joi.object({
            first_name: Joi.string().allow('', null),
            last_name: Joi.string().allow('', null),
            email: Joi.string().email().optional(),
            password: Joi.string().min(6).optional(),
            address: Joi.string().allow('', null),
            phone_number: Joi.string().allow('', null),
            // Users cannot change their own role or status
            role: Joi.forbidden(),
            status: Joi.forbidden(),
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


    // Legacy validators for backward compatibility
    async userCreateValidator(req, res, next) {
        // create schema object
        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(6).required(),
            confirm_password: Joi.string().valid(Joi.ref('password')).required(),
            first_name: Joi.string(),
            last_name: Joi.string(),
        });

        // schema options
        const options = {
            abortEarly: false, // include all errors
            allowUnknown: true, // ignore unknown props
            stripUnknown: true, // remove unknown props
        };

        // validate request body against schema
        const { error, value } = schema.validate(req.body, options);

        if (error) {
            // on fail return comma separated errors
            const errorMessage = error.details
                .map((details) => {
                    return details.message;
                })
                .join(', ');
            next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        } else {
            // on success replace req.body with validated value and trigger next middleware function
            req.body = value;
            return next();
        }
    }

    // Admin creates a user (accept role too)
    async userManageCreateValidator(req, res, next) {
        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(6).required(),
            confirm_password: Joi.string().valid(Joi.ref('password')).required(),
            first_name: Joi.string().allow('', null),
            last_name: Joi.string().allow('', null),
            role: Joi.string().valid('admin', 'user').default('user'),
            status: Joi.number().valid(0, 1, 2).optional(),
        });
        const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
        const { error, value } = schema.validate(req.body, options);
        if (error) {
            const errorMessage = error.details.map((d) => d.message).join(', ');
            return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        }
        req.body = value;
        return next();
    }

    // Admin updates a user (optional password change)
    async userManageUpdateValidator(req, res, next) {
        const schema = Joi.object({
            first_name: Joi.string().allow('', null),
            last_name: Joi.string().allow('', null),
            email: Joi.string().email().optional(),
            password: Joi.string().min(6).optional(),
            address: Joi.string().allow('', null),
            phone_number: Joi.string().allow('', null),
            status: Joi.number().valid(0, 1, 2).optional(),
            role: Joi.forbidden(),
        });
        const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
        const { error, value } = schema.validate(req.body, options);
        if (error) {
            const errorMessage = error.details.map((d) => d.message).join(', ');
            return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        }
        req.body = value;
        return next();
    }

    // Admin updates role only
    async userManageRoleUpdateValidator(req, res, next) {
        const schema = Joi.object({
            role: Joi.string().valid('admin', 'user').required(),
        });
        const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
        const { error, value } = schema.validate(req.body, options);
        if (error) {
            const errorMessage = error.details.map((d) => d.message).join(', ');
            return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        }
        req.body = value;
        return next();
    }

    async userLoginValidator(req, res, next) {
        // create schema object
        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(6).required(),
        });

        // schema options
        const options = {
            abortEarly: false, // include all errors
            allowUnknown: true, // ignore unknown props
            stripUnknown: true, // remove unknown props
        };

        // validate request body against schema
        const { error, value } = schema.validate(req.body, options);

        if (error) {
            // on fail return comma separated errors
            const errorMessage = error.details
                .map((details) => {
                    return details.message;
                })
                .join(', ');
            next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        } else {
            // on success replace req.body with validated value and trigger next middleware function
            req.body = value;
            return next();
        }
    }

    async checkEmailValidator(req, res, next) {
        // create schema object
        const schema = Joi.object({
            email: Joi.string().email().required(),
        });

        // schema options
        const options = {
            abortEarly: false, // include all errors
            allowUnknown: true, // ignore unknown props
            stripUnknown: true, // remove unknown props
        };

        // validate request body against schema
        const { error, value } = schema.validate(req.body, options);

        if (error) {
            // on fail return comma separated errors
            const errorMessage = error.details
                .map((details) => {
                    return details.message;
                })
                .join(', ');
            next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        } else {
            // on success replace req.body with validated value and trigger next middleware function
            req.body = value;
            return next();
        }
    }

    async changePasswordValidator(req, res, next) {
        // create schema object
        const schema = Joi.object({
            old_password: Joi.string().required(),
            password: Joi.string().min(6).required(),
            confirm_password: Joi.string().min(6).required(),
        });

        // schema options
        const options = {
            abortEarly: false, // include all errors
            allowUnknown: true, // ignore unknown props
            stripUnknown: true, // remove unknown props
        };

        // validate request body against schema
        const { error, value } = schema.validate(req.body, options);

        if (error) {
            // on fail return comma separated errors
            const errorMessage = error.details
                .map((details) => {
                    return details.message;
                })
                .join(', ');
            next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        } else {
            // on success replace req.body with validated value and trigger next middleware function
            req.body = value;
            return next();
        }
    }
}

module.exports = UserValidator;
