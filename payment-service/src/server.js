require('dotenv').config()
const logger = require('./utils/logger')
const { connectRabbitMQ, consumeEvent } = require('./utils/rabbitmq')
const handleOrderCreated = require('./utils/eventHandler')

const start = async () => {
  await connectRabbitMQ()
  await consumeEvent(
    'payment-service-queue',
    ['order.created'],
    handleOrderCreated
  )
  logger.info('Payment Service is running (event-driven, no HTTP server)')
}

start()
