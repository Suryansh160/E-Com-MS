const Redis = require('ioredis')
const logger = require('./logger')

const redisClient = new Redis(process.env.REDIS_URL)

redisClient.on('connect', () => {
  logger.info('Connected to Redis (order-service)')
})

redisClient.on('error', err => {
  logger.error(`Redis connection error: ${err.message}`)
})

module.exports = redisClient
