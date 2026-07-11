require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const mongoose = require('mongoose')

const logger = require('./utils/logger')
const { connectRabbitMQ, consumeEvent } = require('./utils/rabbitmq')
const orderRoutes = require('./routes/orderRoutes')
const handleSagaEvent = require('./events/sagaEventHandler')
const connectDB = require('./database/db')

const app = express()
const PORT = process.env.PORT || 3002

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`)
  next()
})

app.use('/api/orders', orderRoutes)

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

const startServer = async () => {
  try {
    await connectDB()

    await connectRabbitMQ()

    await consumeEvent(
      'order-service-queue',
      [
        'inventory.reserved',
        'inventory.reservation_failed',
        'payment.completed',
        'payment.failed'
      ],
      handleSagaEvent
    )

    app.listen(PORT, () => {
      logger.info(`Order Service running on port ${PORT}`)
    })
  } catch (error) {
    logger.error(`Failed to start Order Service: ${error.message}`)
    process.exit(1)
  }
}

startServer()
