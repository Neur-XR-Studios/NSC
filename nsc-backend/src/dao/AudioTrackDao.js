const SuperDao = require('./SuperDao');
const models = require('../models');

const AudioTrack = models.audio_track;

class AudioTrackDao extends SuperDao {
  constructor() {
    super(AudioTrack);
  }
}

module.exports = AudioTrackDao;
