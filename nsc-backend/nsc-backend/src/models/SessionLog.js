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
    video_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    details: {
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
