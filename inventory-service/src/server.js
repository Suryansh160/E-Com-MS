require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const mongoose = require('mongoose')

const logger = require('./utils/logger')
const connectDB = require('./database/db')
const productRoutes = require('./routes/product-routes')
const { connectRabbitMQ, consumeEvent } = require('./utils/rabbitmq')
const handleOrderCreated = require('./utils/eventHandler')

const app = express()
const PORT = process.env.PORT || 3003

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`)
  next()
})

app.use('/api/products', productRoutes)

const startServer = async () => {
  try {
    await connectDB()

    await connectRabbitMQ()

    await consumeEvent(
      'inventory-service-queue',
      ['order.created'],
      handleOrderCreated
    )

    app.listen(PORT, () => {
      logger.info(`Inventory Service is listening to port ${PORT}`)
    })
  } catch (error) {
    logger.error(`Failed to start Order Service: ${error.message}`)
    process.exit(1)
  }
}

startServer()
