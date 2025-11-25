module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add display_name to vr_devices
        await queryInterface.addColumn('vr_devices', 'display_name', {
            type: Sequelize.STRING(32),
            allowNull: true,
            unique: true,
            after: 'id'
        });

        // Add display_name to chair_devices
        await queryInterface.addColumn('chair_devices', 'display_name', {
            type: Sequelize.STRING(32),
            allowNull: true,
            unique: true,
            after: 'id'
        });

        // Generate display names for existing devices
        const [vrDevices] = await queryInterface.sequelize.query(
            'SELECT id FROM vr_devices ORDER BY registered_at ASC'
        );

        for (let i = 0; i < vrDevices.length; i++) {
            const displayName = `VR_#${String(i + 1).padStart(3, '0')}`;
            await queryInterface.sequelize.query(
                'UPDATE vr_devices SET display_name = ? WHERE id = ?',
                { replacements: [displayName, vrDevices[i].id] }
            );
        }

        const [chairDevices] = await queryInterface.sequelize.query(
            'SELECT id FROM chair_devices ORDER BY registered_at ASC'
        );

        for (let i = 0; i < chairDevices.length; i++) {
            const displayName = `CHAIR_#${String(i + 1).padStart(3, '0')}`;
            await queryInterface.sequelize.query(
                'UPDATE chair_devices SET display_name = ? WHERE id = ?',
                { replacements: [displayName, chairDevices[i].id] }
            );
        }

        // Add indexes
        await queryInterface.addIndex('vr_devices', ['display_name'], {
            name: 'idx_vr_display_name'
        });

        await queryInterface.addIndex('chair_devices', ['display_name'], {
            name: 'idx_chair_display_name'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('chair_devices', 'idx_chair_display_name');
        await queryInterface.removeIndex('vr_devices', 'idx_vr_display_name');
        await queryInterface.removeColumn('chair_devices', 'display_name');
        await queryInterface.removeColumn('vr_devices', 'display_name');
    }
};
