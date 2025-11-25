module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    vr_device_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    chair_device_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'ready', 'running', 'paused', 'stopped', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    overall_status: {
      type: DataTypes.ENUM('on_going', 'completed'),
      allowNull: false,
      defaultValue: 'on_going',
    },
    group_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    journey_ids: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    session_type: {
      type: DataTypes.ENUM('group', 'individual'),
      allowNull: false,
      defaultValue: 'individual',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_activity: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    start_time_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    last_command: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    last_position_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    conducted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    total_participants: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    video_view_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paused_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    stopped_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    total_duration_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: 0,
    },
    pause_duration_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: 0,
    },
  }, {
    tableName: 'sessions',
    timestamps: true,
    underscored: true,
  });

  Session.associate = (models) => {
    Session.belongsTo(models.VRDevice, { foreignKey: 'vr_device_id', as: 'vr' });
    Session.belongsTo(models.ChairDevice, { foreignKey: 'chair_device_id', as: 'chair' });
    Session.hasMany(models.SessionLog, { foreignKey: 'session_id', as: 'logs' });
    Session.hasMany(models.SessionParticipant, { foreignKey: 'session_id', as: 'participants' });
  };

  return Session;
};
