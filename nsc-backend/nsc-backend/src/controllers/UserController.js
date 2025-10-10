const httpStatus = require('http-status');
const UserService = require('../service/UserService');
const logger = require('../config/logger');

class UserController {
    constructor() {
        this.service = new UserService();
    }

    // POST /api/users
    create = async (req, res) => {
        try {
            const result = await this.service.create(req.body);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send(e);
        }
    };

    // GET /api/users
    list = async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await this.service.list(page, limit);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send(e);
        }
    };

    // GET /api/users/:id
    get = async (req, res) => {
        try {
            const result = await this.service.getById(req.params.id);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send(e);
        }
    };

    // PATCH /api/users/:id (partial update including role and status)
    update = async (req, res) => {
        try {
            const result = await this.service.update(req.params.id, req.body);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send(e);
        }
    };

    // DELETE /api/users/:id
    remove = async (req, res) => {
        try {
            const result = await this.service.remove(req.params.id);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send(e);
        }
    };

    // GET /api/users/profile (get current user profile)
    getProfile = async (req, res) => {
        try {
            const result = await this.service.getProfile(req.user);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send(e);
        }
    };

    // PATCH /api/users/profile (update current user profile)
    updateProfile = async (req, res) => {
        try {
            const result = await this.service.updateProfile(req.user, req.body);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send(e);
        }
    };
}

module.exports = UserController;
