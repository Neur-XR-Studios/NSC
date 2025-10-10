const SuperDao = require('./SuperDao');
const models = require('../models');

const JourneyAudioTrack = models.journey_audio_track;

class JourneyAudioTrackDao extends SuperDao {
  constructor() {
    super(JourneyAudioTrack);
  }
}

module.exports = JourneyAudioTrackDao;
