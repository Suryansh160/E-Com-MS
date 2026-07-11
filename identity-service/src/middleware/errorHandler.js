const logger = require('../utils/logger')

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack)

  res.status(err.status || 5000).json({
    message: err.message || 'Internal server error'
  })
  next()
}

module.exports = errorHandler
