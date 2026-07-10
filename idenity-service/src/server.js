require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const errorHandler = require('./middleware/errorHandler')
const connectDB = require('./database/db')
const { RateLimiterRedis } = require('rate-limiter-flexible')
const Redis = require('ioredis')
const logger = require('./utils/logger')
const router = require('./routes/identiy-routes')

const PORT = process.env.PORT || 3001
const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

connectDB()

app.use((req, res, next) => {
  logger.info(`Recieved ${req.method} request to ${req.url}`)
  logger.info(`Request body, ${JSON.stringify(req.body)}`)
  next()
})

const redisClient = new Redis(process.env.REDIS_URL)

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: 10,
  duration: 1
})

app.use((req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => {
      logger.warn(`Rate limiter exceeded for IP: ${req.ip}`)
      res.status(429).json({ success: false, message: 'Too many attempts' })
    })
})

app.use('/api/auth', router)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Server is listening to port ${PORT}`)
})
