const httpStatus = require('http-status');
const UserService = require('../service/UserService');
const logger = require('../config/logger');

class UserManagementController {
  constructor() {
    this.userService = new UserService();
  }

  // POST /api/users
  create = async (req, res) => {
    try {
      const result = await this.userService.createUser(req.body);
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
      const result = await this.userService.listUsers(page, limit);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // GET /api/users/:uuid
  get = async (req, res) => {
    try {
      const result = await this.userService.getByUuid(req.params.uuid);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // PUT /api/users/:uuid
  update = async (req, res) => {
    try {
      const result = await this.userService.updateByUuid(req.params.uuid, req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // DELETE /api/users/:uuid
  remove = async (req, res) => {
    try {
      const result = await this.userService.deleteByUuid(req.params.uuid);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // PATCH /api/users/:uuid/role
  updateRole = async (req, res) => {
    try {
      const { role } = req.body;
      const result = await this.userService.updateRole(req.params.uuid, role);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };
}

module.exports = UserManagementController;
