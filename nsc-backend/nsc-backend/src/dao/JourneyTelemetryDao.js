const SuperDao = require('./SuperDao');
const models = require('../models');

const JourneyTelemetry = models.journey_telemetry;

class JourneyTelemetryDao extends SuperDao {
  constructor() {
    super(JourneyTelemetry);
  }
}

module.exports = JourneyTelemetryDao;
