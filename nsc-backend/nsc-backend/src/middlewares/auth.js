const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');

const verifyCallback = (req, res, resolve, reject) => {
    return async (err, user, info) => {
        if (err || info || !user) {
            return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
        }
        req.user = user;

        resolve();
    };
};

const auth = (roles = []) => {
    return async (req, res, next) => {
        return new Promise((resolve, reject) => {
            passport.authenticate(
                'jwt',
                { session: false },
                verifyCallback(req, res, resolve, reject),
            )(req, res, next);
        })
            .then(() => {
                // role-based authorization
                if (Array.isArray(roles) && roles.length > 0) {
                    const userRole = req.user.role;
                    if (!userRole || !roles.includes(userRole)) {
                        return next(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
                    }
                }
                return next();
            })
            .catch((err) => {
                return next(err);
            });
    };
};

module.exports = auth;
