const express = require('express');
const authRoute = require('./authRoute');
const userRoute = require('./userRoute');
const videoRoute = require('./videoRoute');
const audioRoute = require('./audioRoute');
const telemetryRoute = require('./telemetryRoute');
const journeyRoute = require('./journeyRoute');
const deviceRoute = require('./deviceRoute');
const devicePairRoute = require('./devicePairRoute');
const sessionRoute = require('./sessionRoute');
const sessionLogRoute = require('./sessionLogRoute');
const sessionFeedbackRoute = require('./sessionFeedbackRoute');
const analyticsRoute = require('./analyticsRoute');
const mqttRoute = require('./mqttRoute');
const router = express.Router();

const defaultRoutes = [
    {
        path: '/auth',
        route: authRoute,
    },
    {
        path: '/users',
        route: userRoute,
    },
    {
        path: '/videos',
        route: videoRoute,
    },
    {
        path: '/audio-tracks',
        route: audioRoute,
    },
    {
        path: '/telemetry',
        route: telemetryRoute,
    },
    {
        path: '/journeys',
        route: journeyRoute,
    },
    {
        path: '/devices',
        route: deviceRoute,
    },
    {
        path: '/device-pairs',
        route: devicePairRoute,
    },
    {
        path: '/sessions',
        route: sessionRoute,
    },
    {
        path: '/session-logs',
        route: sessionLogRoute,
    },
    {
        path: '/session-feedbacks',
        route: sessionFeedbackRoute,
    },
    {
        path: '/analytics',
        route: analyticsRoute,
    },
    {
        path: '/mqtt',
        route: mqttRoute,
    },
];

defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

module.exports = router;
