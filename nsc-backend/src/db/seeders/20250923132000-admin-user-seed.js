const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const adminExists = await queryInterface.sequelize.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const count = parseInt(adminExists[0].count, 10);
    if (count > 0) return Promise.resolve();

    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';
    const firstName = process.env.ADMIN_FIRST_NAME || 'Admin';
    const lastName = process.env.ADMIN_LAST_NAME || 'User';

    return queryInterface.bulkInsert('users', [
      {
        uuid: require('uuid').v4(),
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        role: 'admin',
        status: 1,
        email_verified: 1,
        password: bcrypt.hashSync(password, 8),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('users', { role: 'admin' }, {});
  },
};
