module.exports = (sequelize, DataTypes) => {
    const SessionFeedback = sequelize.define('SessionFeedback', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        session_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'sessions',
                key: 'id',
            },
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5,
                isInt: true,
            },
        },
        feedback_text: {
            type: DataTypes.TEXT,
            allowNull: true,
            validate: {
                len: [0, 500],
            },
        },
    }, {
        tableName: 'session_feedbacks',
        timestamps: true,
        underscored: true,
    });

    SessionFeedback.associate = (models) => {
        SessionFeedback.belongsTo(models.Session, {
            foreignKey: 'session_id',
            as: 'session',
        });
    };

    return SessionFeedback;
};
