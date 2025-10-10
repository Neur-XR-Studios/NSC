const SuperDao = require('./SuperDao');
const models = require('../models');

const Journey = models.journey;

class JourneyDao extends SuperDao {
  constructor() {
    super(Journey);
  }
}

module.exports = JourneyDao;
