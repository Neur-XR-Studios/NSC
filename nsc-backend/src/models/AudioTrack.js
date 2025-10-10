const { Model } = require('sequelize');
  
  module.exports = (sequelize, DataTypes) => {
    class AudioTrack extends Model {
      static associate(models) {
        AudioTrack.hasMany(models.journey_audio_track, {
          foreignKey: 'audio_track_id',
          as: 'journeyAudioTracks'
        });
      }
    }
  
    AudioTrack.init(
      {
        language_code: DataTypes.STRING,
        channels: DataTypes.INTEGER,
        sample_rate_hz: DataTypes.INTEGER,
        duration_ms: DataTypes.INTEGER,
        audio_url: DataTypes.STRING, // stores only generated filename
        mime_type: DataTypes.STRING,
      },
      {
        sequelize,
        modelName: 'audio_track',
        underscored: true,
        tableName: 'audio_tracks',
      }
    );
  
    return AudioTrack;
  };
