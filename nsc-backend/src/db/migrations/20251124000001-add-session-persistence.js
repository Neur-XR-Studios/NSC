module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('sessions', 'is_active', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            after: 'session_type'
        });

        await queryInterface.addColumn('sessions', 'last_activity', {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            after: 'is_active'
        });

        // Add indexes for better query performance
        await queryInterface.addIndex('sessions', ['is_active'], {
            name: 'idx_sessions_active'
        });

        await queryInterface.addIndex('sessions', ['session_type'], {
            name: 'idx_sessions_type'
        });

        await queryInterface.addIndex('sessions', ['is_active', 'session_type'], {
            name: 'idx_sessions_active_type'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('sessions', 'idx_sessions_active_type');
        await queryInterface.removeIndex('sessions', 'idx_sessions_type');
        await queryInterface.removeIndex('sessions', 'idx_sessions_active');
        await queryInterface.removeColumn('sessions', 'last_activity');
        await queryInterface.removeColumn('sessions', 'is_active');
    }
};
