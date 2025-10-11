module.exports = (sequelize, DataTypes) => {
  const SessionLog = sequelize.define('SessionLog', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    event: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'e.g., video_started, video_finished, error, note',
    },
    journey_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    vr_device_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    position_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Playback position when the event occurred',
    },
    error_code: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'session_logs',
    timestamps: true,
    underscored: true,
  });

  SessionLog.associate = (models) => {
    SessionLog.belongsTo(models.Session, { foreignKey: 'session_id', as: 'session' });
  };

  return SessionLog;
};
