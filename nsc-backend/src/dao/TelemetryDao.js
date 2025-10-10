const SuperDao = require('./SuperDao');
const models = require('../models');

const Telemetry = models.telemetry;

class TelemetryDao extends SuperDao {
  constructor() {
    super(Telemetry);
  }
}

module.exports = TelemetryDao;
