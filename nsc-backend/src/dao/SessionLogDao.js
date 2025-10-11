const SuperDao = require('./SuperDao');
const models = require('../models');

const SessionLog = models.SessionLog;

class SessionLogDao extends SuperDao {
  constructor() {
    super(SessionLog);
  }
}

module.exports = SessionLogDao;
