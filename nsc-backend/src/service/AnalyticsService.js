const { Session, SessionParticipant, Journey } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../models');

class AnalyticsService {
    /**
     * Get comprehensive analytics overview
     * @param {Date} startDate - Optional start date filter
     * @param {Date} endDate - Optional end date filter
     * @returns {Object} Analytics overview
     */
    async getOverview(startDate = null, endDate = null) {
        const dateFilter = this._buildDateFilter(startDate, endDate);

        const [sessionMetrics, seatMetrics, moduleMetrics, timeMetrics] = await Promise.all([
            this.getSessionMetrics(startDate, endDate),
            this.getSeatUtilization(startDate, endDate),
            this.getModuleUsage(startDate, endDate),
            this.getTimeMetrics(startDate, endDate),
        ]);

        return {
            sessions: sessionMetrics,
            seats: seatMetrics,
            modules: moduleMetrics,
            time: timeMetrics,
        };
    }

    /**
     * Get session count metrics
     * @param {Date} startDate - Optional start date filter
     * @param {Date} endDate - Optional end date filter
     * @returns {Object} Session metrics
     */
    async getSessionMetrics(startDate = null, endDate = null) {
        const dateFilter = this._buildDateFilter(startDate, endDate);

        // Total sessions
        const totalSessions = await Session.count({ where: dateFilter });

        // Sessions by status
        const sessionsByStatus = await Session.findAll({
            where: dateFilter,
            attributes: ['overall_status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['overall_status'],
            raw: true,
        });

        // Sessions by type (individual vs group)
        const sessionsByType = await Session.findAll({
            where: dateFilter,
            attributes: ['session_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['session_type'],
            raw: true,
        });

        // Sessions over time (daily for last 30 days or date range)
        const sessionsOverTime = await Session.findAll({
            where: dateFilter,
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true,
        });

        return {
            total: totalSessions,
            byStatus: sessionsByStatus,
            byType: sessionsByType,
            overTime: sessionsOverTime,
        };
    }

    /**
     * Get seat utilization metrics
     * @param {Date} startDate - Optional start date filter
     * @param {Date} endDate - Optional end date filter
     * @returns {Object} Seat utilization metrics
     */
    async getSeatUtilization(startDate = null, endDate = null) {
        const dateFilter = this._buildDateFilter(startDate, endDate);

        // Get all sessions with participant counts
        const sessions = await Session.findAll({
            where: dateFilter,
            attributes: [
                'id',
                'session_type',
                [sequelize.fn('COUNT', sequelize.col('participants.id')), 'participant_count'],
            ],
            include: [
                {
                    model: SessionParticipant,
                    as: 'participants', // Must use alias defined in Session.associate
                    attributes: [],
                },
            ],
            group: ['Session.id', 'Session.session_type'],
            raw: true,
        });

        let totalSeats = 0;
        let filledSeats = 0;

        sessions.forEach((session) => {
            const capacity = session.session_type === 'individual' ? 1 : 4; // Assuming group max = 4
            totalSeats += capacity;
            filledSeats += parseInt(session.participant_count) || 0;
        });

        const utilizationRate = totalSeats > 0 ? (filledSeats / totalSeats) * 100 : 0;

        return {
            totalSeats,
            filledSeats,
            utilizationRate: parseFloat(utilizationRate.toFixed(2)),
            averageParticipantsPerSession: sessions.length > 0 ? filledSeats / sessions.length : 0,
        };
    }

    /**
     * Get VR module/journey usage statistics
     * @param {Date} startDate - Optional start date filter
     * @param {Date} endDate - Optional end date filter
     * @returns {Object} Module usage statistics
     */
    async getModuleUsage(startDate = null, endDate = null) {
        const dateFilter = this._buildDateFilter(startDate, endDate);

        // Get all sessions with journey information
        const sessions = await Session.findAll({
            where: dateFilter,
            attributes: ['journey_ids'],
            raw: true,
        });

        // Count journey occurrences
        const journeyCounts = {};
        let totalJourneys = 0;

        sessions.forEach((session) => {
            if (session.journey_ids) {
                let journeyIds = [];
                try {
                    journeyIds = typeof session.journey_ids === 'string'
                        ? JSON.parse(session.journey_ids)
                        : session.journey_ids;
                } catch (e) {
                    // If not valid JSON, skip
                    return;
                }

                if (Array.isArray(journeyIds)) {
                    journeyIds.forEach((journeyId) => {
                        journeyCounts[journeyId] = (journeyCounts[journeyId] || 0) + 1;
                        totalJourneys++;
                    });
                }
            }
        });

        // Get journey details and calculate percentages
        const journeyStats = await Promise.all(
            Object.entries(journeyCounts).map(async ([journeyId, count]) => {
                let journeyName = `Journey ${journeyId}`;

                // Try to get journey name from database
                try {
                    const journey = await Journey.findByPk(journeyId);
                    if (journey) {
                        journeyName = journey.name || journeyName;
                    }
                } catch (e) {
                    // Journey model might not exist, use default name
                }

                return {
                    journeyId,
                    journeyName,
                    count,
                    percentage: totalJourneys > 0 ? parseFloat(((count / totalJourneys) * 100).toFixed(2)) : 0,
                };
            })
        );

        // Sort by count descending
        journeyStats.sort((a, b) => b.count - a.count);

        return {
            total: totalJourneys,
            mostPopular: journeyStats[0] || null,
            usage: journeyStats,
        };
    }

    /**
     * Get time tracking metrics
     * @param {Date} startDate - Optional start date filter
     * @param {Date} endDate - Optional end date filter
     * @returns {Object} Time metrics
     */
    async getTimeMetrics(startDate = null, endDate = null) {
        const dateFilter = this._buildDateFilter(startDate, endDate);

        // Get sessions with timestamps
        const sessions = await Session.findAll({
            where: {
                ...dateFilter,
                created_at: { [Op.ne]: null },
                updated_at: { [Op.ne]: null },
            },
            attributes: ['id', 'created_at', 'updated_at', 'overall_status'],
            raw: true,
        });

        let totalDurationMinutes = 0;
        let sessionCount = 0;

        sessions.forEach((session) => {
            const start = new Date(session.created_at);
            const end = new Date(session.updated_at);
            const durationMs = end - start;
            const durationMinutes = durationMs / (1000 * 60);

            // Only count reasonable durations (less than 24 hours)
            if (durationMinutes > 0 && durationMinutes < 1440) {
                totalDurationMinutes += durationMinutes;
                sessionCount++;
            }
        });

        const averageDurationMinutes = sessionCount > 0 ? totalDurationMinutes / sessionCount : 0;
        const totalHours = totalDurationMinutes / 60;

        return {
            totalSessions: sessionCount,
            totalTimeMinutes: parseFloat(totalDurationMinutes.toFixed(2)),
            totalTimeHours: parseFloat(totalHours.toFixed(2)),
            averageSessionMinutes: parseFloat(averageDurationMinutes.toFixed(2)),
            averageSessionHours: parseFloat((averageDurationMinutes / 60).toFixed(2)),
        };
    }

    /**
     * Build date filter for queries
     * @param {Date} startDate - Optional start date
     * @param {Date} endDate - Optional end date
     * @returns {Object} Sequelize where clause
     * @private
     */
    _buildDateFilter(startDate, endDate) {
        const filter = {};

        if (startDate || endDate) {
            filter.created_at = {};
            if (startDate) {
                filter.created_at[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                filter.created_at[Op.lte] = new Date(endDate);
            }
        }

        return filter;
    }
}

module.exports = AnalyticsService;
