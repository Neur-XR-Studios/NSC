const config = require('./config');

module.exports = {
    development: {
        username: config.dbUser,
        password: config.dbPass,
        database: config.dbName,
        host: config.dbHost,
        port: config.dbPort,
        dialect: 'mysql',
        dialectOptions: {
            bigNumberStrings: true,
        },
        logging: false,
    },
    test: {
        username: config.dbUser,
        password: config.dbPass,
        database: config.dbName,
        host: config.dbHost,
        port: config.dbPort,
        dialect: 'mysql',
        dialectOptions: {
            bigNumberStrings: true,
        },
        logging: false,
    },
    production: {
        username: config.dbUser,
        password: config.dbPass,
        database: config.dbName,
        host: config.dbHost,
        port: config.dbPort,
        dialect: 'mysql',
        dialectOptions: {
            bigNumberStrings: true,
        },
        logging: false,
    },
};
