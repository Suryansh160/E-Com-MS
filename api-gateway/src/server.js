require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const authMiddleware = require('./middleware/auth-middleware')
const { RateLimiterRedis } = require('rate-limiter-flexible')
const limiter = require('./utils/rateLimiter')
const Redis = require('ioredis')
const logger = require('./utils/logger')
const proxy = require('express-http-proxy')

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  logger.info(`Recieved ${req.method} request to ${req.url}`)
  logger.info(`Request body, ${JSON.stringify(req.body)}`)
  next()
})

app.use(limiter)

const proxyOptions = {
  proxyReqPathResolver: req => {
    return req.originalUrl.replace(/^\/v1/, '/api')
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`)
    res.status(500).json({
      message: 'Internal server error',
      error: err.message
    })
  }
}

app.use(
  '/v1/auth',
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers['Content-Type'] = 'application/json'
      return proxyReqOpts
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response recieved from Identity service: ${proxyRes.statusCode}`
      )

      return proxyResData
    }
  })
)

app.use(
  '/v1/orders',
  authMiddleware,
  proxy(process.env.ORDER_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers['Content-Type'] = 'application/json'
      proxyReqOpts.headers['x-user-id'] = srcReq.user.userId
      return proxyReqOpts
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response recieved from Order service: ${proxyRes.statusCode}`
      )
      return proxyResData
    }
  })
)

app.listen(PORT, () => {
  logger.info(`Api Gateway is running on port ${PORT}`)
  logger.info(
    `Identity service is running on port ${process.env.IDENTITY_SERVICE_URL}`
  )
  logger.info(
    `Order service is running on port ${process.env.ORDER_SERVICE_URL}`
  )
})
