const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const UserDao = require('../dao/UserDao');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');
const { userConstant } = require('../config/constant');

class UserService {
    constructor() {
        this.userDao = new UserDao();
    }

    // Standard CRUD operations following the same pattern as other services
    create = async (body) => {
        try {
            let message = 'User created successfully';
            if (await this.userDao.isEmailExists(body.email)) {
                return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Email already taken');
            }
            const uuid = uuidv4();
            body.email = body.email.toLowerCase();
            body.password = bcrypt.hashSync(body.password, 8);
            body.uuid = uuid;
            body.status = body.status || userConstant.STATUS_ACTIVE;
            body.email_verified = body.email_verified || userConstant.EMAIL_VERIFIED_FALSE;

            let userData = await this.userDao.create(body);

            if (!userData) {
                message = 'User creation failed! Please try again.';
                return responseHandler.returnError(httpStatus.BAD_REQUEST, message);
            }

            userData = userData.toJSON();
            delete userData.password;

            return responseHandler.returnSuccess(httpStatus.CREATED, message, userData);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };

    list = async (page = 1, limit = 20) => {
        try {
            const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
            const result = await this.userDao.Model.findAndCountAll({
                limit: parseInt(limit, 10),
                offset,
                order: [['id', 'DESC']],
                attributes: { exclude: ['password'] },
            });
            return responseHandler.returnSuccess(httpStatus.OK, 'Users fetched', {
                total: result.count,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                data: result.rows,
            });
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };

    getById = async (id) => {
        try {
            const user = await this.userDao.findOneByWhere({ id: parseInt(id, 10) });
            if (!user) {
                return responseHandler.returnError(httpStatus.NOT_FOUND, 'User not found!');
            }
            const data = user.toJSON();
            delete data.password;
            return responseHandler.returnSuccess(httpStatus.OK, 'User fetched', data);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };

    update = async (id, payload) => {
        try {
            const user = await this.userDao.findOneByWhere({ id: parseInt(id, 10) });
            if (!user) {
                return responseHandler.returnError(httpStatus.NOT_FOUND, 'User not found!');
            }
            if (payload.password) {
                payload.password = bcrypt.hashSync(payload.password, 8);
            }
            if (payload.email) {
                payload.email = payload.email.toLowerCase();
                // Check if email is already taken by another user
                const existingUser = await this.userDao.findOneByWhere({ email: payload.email });
                if (existingUser && existingUser.id !== parseInt(id, 10)) {
                    return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Email already taken');
                }
            }
            await this.userDao.updateWhere(payload, { id: parseInt(id, 10) });
            const updated = await this.userDao.findOneByWhere({ id: parseInt(id, 10) });
            const data = updated.toJSON();
            delete data.password;
            return responseHandler.returnSuccess(httpStatus.OK, 'User updated', data);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };

    remove = async (id) => {
        try {
            const user = await this.userDao.findOneByWhere({ id: parseInt(id, 10) });
            if (!user) {
                return responseHandler.returnError(httpStatus.NOT_FOUND, 'User not found!');
            }
            await this.userDao.deleteByWhere({ id: parseInt(id, 10) });
            return responseHandler.returnSuccess(httpStatus.OK, 'User deleted', {});
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };

    // Additional user-specific methods
    getProfile = async (user) => {
        try {
            const userData = await this.userDao.findOneByWhere({ id: user.id });
            if (!userData) {
                return responseHandler.returnError(httpStatus.NOT_FOUND, 'User not found!');
            }
            const data = userData.toJSON();
            delete data.password;
            return responseHandler.returnSuccess(httpStatus.OK, 'Profile fetched', data);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };

    updateProfile = async (user, payload) => {
        try {
            if (payload.password) {
                payload.password = bcrypt.hashSync(payload.password, 8);
            }
            if (payload.email) {
                payload.email = payload.email.toLowerCase();
                // Check if email is already taken by another user
                const existingUser = await this.userDao.findOneByWhere({ email: payload.email });
                if (existingUser && existingUser.id !== user.id) {
                    return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Email already taken');
                }
            }
            await this.userDao.updateWhere(payload, { id: user.id });
            const updated = await this.userDao.findOneByWhere({ id: user.id });
            const data = updated.toJSON();
            delete data.password;
            return responseHandler.returnSuccess(httpStatus.OK, 'Profile updated', data);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };


    // Legacy methods for backward compatibility

    /**
     * Create a user
     * @param {Object} userBody
     * @returns {Object}
     */
    createUser = async (userBody) => {
        try {
            let message = 'Successfully Registered the account! Please Verify your email.';
            if (await this.userDao.isEmailExists(userBody.email)) {
                return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Email already taken');
            }
            const uuid = uuidv4();
            userBody.email = userBody.email.toLowerCase();
            userBody.password = bcrypt.hashSync(userBody.password, 8);
            userBody.uuid = uuid;
            userBody.status = userConstant.STATUS_ACTIVE;
            userBody.email_verified = userConstant.EMAIL_VERIFIED_FALSE;

            let userData = await this.userDao.create(userBody);

            if (!userData) {
                message = 'Registration Failed! Please Try again.';
                return responseHandler.returnError(httpStatus.BAD_REQUEST, message);
            }

            userData = userData.toJSON();
            delete userData.password;

            return responseHandler.returnSuccess(httpStatus.CREATED, message, userData);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Something went wrong!');
        }
    };

    /**
     * List users with pagination (optional)
     */
    listUsers = async (page = 1, limit = 20) => {
        const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
        const result = await this.userDao.Model.findAndCountAll({
            limit: parseInt(limit, 10),
            offset,
            order: [['id', 'DESC']],
            attributes: { exclude: ['password'] },
        });
        return responseHandler.returnSuccess(httpStatus.OK, 'Users fetched', {
            total: result.count,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            data: result.rows,
        });
    };

    /**
     * Get user details by uuid
     */
    getByUuid = async (uuid) => {
        const user = await this.userDao.findOneByWhere({ uuid });
        if (!user) {
            return responseHandler.returnError(httpStatus.NOT_FOUND, 'User Not found!');
        }
        const data = user.toJSON();
        delete data.password;
        return responseHandler.returnSuccess(httpStatus.OK, 'User fetched', data);
    };

    /**
     * Update user (admin only fields allowed by validator)
     */
    updateByUuid = async (uuid, payload) => {
        const user = await this.userDao.findOneByWhere({ uuid });
        if (!user) {
            return responseHandler.returnError(httpStatus.NOT_FOUND, 'User Not found!');
        }
        if (payload.password) {
            payload.password = bcrypt.hashSync(payload.password, 8);
        }
        await this.userDao.updateWhere(payload, { uuid });
        const updated = await this.userDao.findOneByWhere({ uuid });
        const data = updated.toJSON();
        delete data.password;
        return responseHandler.returnSuccess(httpStatus.OK, 'User updated', data);
    };

    /**
     * Delete user by uuid
     */
    deleteByUuid = async (uuid) => {
        const user = await this.userDao.findOneByWhere({ uuid });
        if (!user) {
            return responseHandler.returnError(httpStatus.NOT_FOUND, 'User Not found!');
        }
        await this.userDao.deleteByWhere({ uuid });
        return responseHandler.returnSuccess(httpStatus.OK, 'User deleted', {});
    };

    /**
     * Update role for a user
     */
    updateRole = async (uuid, role) => {
        const user = await this.userDao.findOneByWhere({ uuid });
        if (!user) {
            return responseHandler.returnError(httpStatus.NOT_FOUND, 'User Not found!');
        }
        await this.userDao.updateWhere({ role }, { uuid });
        const updated = await this.userDao.findOneByWhere({ uuid });
        const data = updated.toJSON();
        delete data.password;
        return responseHandler.returnSuccess(httpStatus.OK, 'Role updated', data);
    };

    /** Ensure there is at least one admin user; create default if missing */
    ensureAdminExists = async () => {
        try {
            const adminExists = await this.userDao.checkExist({ role: 'admin' });
            if (adminExists) return;
            const email = process.env.ADMIN_EMAIL || 'admin@example.com';
            const password = process.env.ADMIN_PASSWORD || 'Admin@123';
            const firstName = process.env.ADMIN_FIRST_NAME || 'Admin';
            const lastName = process.env.ADMIN_LAST_NAME || 'User';
            if (await this.userDao.isEmailExists(email)) return; // if some user already using that email

            const uuid = uuidv4();
            const userBody = {
                uuid,
                first_name: firstName,
                last_name: lastName,
                email: email.toLowerCase(),
                password: bcrypt.hashSync(password, 8),
                role: 'admin',
                status: userConstant.STATUS_ACTIVE,
                email_verified: userConstant.EMAIL_VERIFIED_TRUE,
            };
            await this.userDao.create(userBody);
            // do not expose password in logs
            return true;
        } catch (e) {
            logger.error(e);
            return false;
        }
    };

    /**
     * Get user
     * @param {String} email
     * @returns {Object}
     */

    isEmailExists = async (email) => {
        const message = 'Email found!';
        if (!(await this.userDao.isEmailExists(email))) {
            return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Email not Found!!');
        }
        return responseHandler.returnSuccess(httpStatus.OK, message);
    };

    getUserByUuid = async (uuid) => {
        return this.userDao.findOneByWhere({ uuid });
    };

    changePassword = async (data, uuid) => {
        let message = 'Login Successful';
        let statusCode = httpStatus.OK;
        let user = await this.userDao.findOneByWhere({ uuid });

        if (!user) {
            return responseHandler.returnError(httpStatus.NOT_FOUND, 'User Not found!');
        }

        if (data.password !== data.confirm_password) {
            return responseHandler.returnError(
                httpStatus.BAD_REQUEST,
                'Confirm password not matched',
            );
        }

        const isPasswordValid = await bcrypt.compare(data.old_password, user.password);
        user = user.toJSON();
        delete user.password;
        if (!isPasswordValid) {
            statusCode = httpStatus.BAD_REQUEST;
            message = 'Wrong old Password!';
            return responseHandler.returnError(statusCode, message);
        }
        const updateUser = await this.userDao.updateWhere(
            { password: bcrypt.hashSync(data.password, 8) },
            { uuid },
        );

        if (updateUser) {
            return responseHandler.returnSuccess(
                httpStatus.OK,
                'Password updated Successfully!',
                {},
            );
        }

        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Password Update Failed!');
    };
}

module.exports = UserService;
