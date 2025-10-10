module.exports = (sequelize, DataTypes) => {
  const PlaybackEntry = sequelize.define('PlaybackEntry', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    participant_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    journey_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    video_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    language: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    vr_sync_ok: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    chair_sync_ok: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    avg_drift_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    max_drift_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    error_code: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'playback_entries',
    timestamps: true,
    underscored: true,
  });

  PlaybackEntry.associate = (models) => {
    PlaybackEntry.belongsTo(models.Session, { foreignKey: 'session_id', as: 'session' });
    PlaybackEntry.belongsTo(models.SessionParticipant, { foreignKey: 'participant_id', as: 'participant' });
  };

  return PlaybackEntry;
};
