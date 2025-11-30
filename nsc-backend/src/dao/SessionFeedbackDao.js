const { SessionFeedback, Session } = require('../models');
const logger = require('../config/logger');

class SessionFeedbackDao {
    async create(data) {
        try {
            const feedback = await SessionFeedback.create(data);
            return feedback;
        } catch (error) {
            logger.error('Error creating session feedback:', error);
            throw error;
        }
    }

    async findById(id) {
        try {
            const feedback = await SessionFeedback.findByPk(id, {
                include: [{ model: Session, as: 'session' }],
            });
            return feedback;
        } catch (error) {
            logger.error('Error finding session feedback by ID:', error);
            throw error;
        }
    }

    async findBySessionId(sessionId) {
        try {
            const feedback = await SessionFeedback.findOne({
                where: { session_id: sessionId },
                include: [{ model: Session, as: 'session' }],
            });
            return feedback;
        } catch (error) {
            logger.error('Error finding session feedback by session ID:', error);
            throw error;
        }
    }

    async findAll({ page = 1, limit = 10, search = '' }) {
        try {
            const offset = (page - 1) * limit;
            const whereClause = {};

            if (search) {
                whereClause.session_id = { [require('sequelize').Op.like]: `%${search}%` };
            }

            const { count, rows } = await SessionFeedback.findAndCountAll({
                where: whereClause,
                include: [{ model: Session, as: 'session' }],
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                order: [['created_at', 'DESC']],
            });

            return {
                data: rows,
                total: count,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                totalPages: Math.ceil(count / limit),
            };
        } catch (error) {
            logger.error('Error finding all session feedbacks:', error);
            throw error;
        }
    }

    async getStats() {
        try {
            const { Sequelize } = require('../models');
            const stats = await SessionFeedback.findOne({
                attributes: [
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'total_count'],
                    [Sequelize.fn('AVG', Sequelize.col('rating')), 'average_rating'],
                    [Sequelize.fn('MIN', Sequelize.col('rating')), 'min_rating'],
                    [Sequelize.fn('MAX', Sequelize.col('rating')), 'max_rating'],
                ],
                raw: true,
            });

            // Get rating distribution
            const distribution = await SessionFeedback.findAll({
                attributes: [
                    'rating',
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
                ],
                group: ['rating'],
                raw: true,
            });

            return {
                total_count: parseInt(stats?.total_count || 0, 10),
                average_rating: parseFloat(stats?.average_rating || 0).toFixed(2),
                min_rating: parseInt(stats?.min_rating || 0, 10),
                max_rating: parseInt(stats?.max_rating || 0, 10),
                distribution: distribution.reduce((acc, item) => {
                    acc[item.rating] = parseInt(item.count, 10);
                    return acc;
                }, {}),
            };
        } catch (error) {
            logger.error('Error getting session feedback stats:', error);
            throw error;
        }
    }
}

module.exports = SessionFeedbackDao;
