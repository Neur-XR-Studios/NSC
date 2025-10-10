const SuperDao = require('./SuperDao');
const models = require('../models');

const Video = models.video;

class VideoDao extends SuperDao {
  constructor() {
    super(Video);
  }
}

module.exports = VideoDao;
