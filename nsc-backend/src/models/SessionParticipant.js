module.exports = (sequelize, DataTypes) => {
  const SessionParticipant = sequelize.define('SessionParticipant', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    vr_device_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    chair_device_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    participant_code: {
      type: DataTypes.STRING(6),
      allowNull: true,
    },
    language: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    left_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sync_ok_rate: {
      type: DataTypes.DECIMAL(5, 2),
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
    status: {
      type: DataTypes.ENUM('active', 'left', 'completed'),
      allowNull: false,
      defaultValue: 'active',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'session_participants',
    timestamps: true,
    underscored: true,
  });

  SessionParticipant.associate = (models) => {
    SessionParticipant.belongsTo(models.Session, { foreignKey: 'session_id', as: 'session' });
    SessionParticipant.belongsTo(models.VRDevice, { foreignKey: 'vr_device_id', as: 'vr' });
    SessionParticipant.belongsTo(models.ChairDevice, { foreignKey: 'chair_device_id', as: 'chair' });
    SessionParticipant.hasMany(models.PlaybackEntry, { foreignKey: 'participant_id', as: 'playbacks' });
  };

  return SessionParticipant;
};
