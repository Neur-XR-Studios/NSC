const bcrypt = require('bcryptjs');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if any user already exists to avoid unique/validation errors on re-seed
        const [rows] = await queryInterface.sequelize.query('SELECT COUNT(*) AS cnt FROM users');
        const count = Array.isArray(rows)
            ? (rows[0]?.cnt ?? rows[0]?.COUNT ?? rows[0]?.count ?? 0)
            : (rows?.cnt ?? rows?.COUNT ?? rows?.count ?? 0);
        if (Number(count) > 0) {
            return Promise.resolve();
        }

        return queryInterface.bulkInsert('users', [
            {
                uuid: Sequelize.literal('UUID()'),
                first_name: 'John',
                last_name: 'Doe',
                email: 'user@example.com',
                status: 1,
                email_verified: 1,
                password: bcrypt.hashSync('123456', 8),
                created_at: new Date(),
                updated_at: new Date(),
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('users', null, {});
    },
};
