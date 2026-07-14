const amqp = require('amqplib')
const logger = require('./logger')

const EXCHANGE_NAME = 'ecommerce_events'
const EXCHANGE_TYPE = 'topic'

let connection = null
let channel = null

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL)
    channel = await connection.createChannel()
    await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
      durable: true
    })

    logger.info('Connected to RabbitMQ')

    connection.on('error', err => {
      logger.error(`RabbitMQ connection error: ${err.message}`)
    })

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed, retrying in 5s...')
      setTimeout(connectRabbitMQ, 5000)
    })

    return channel
  } catch (error) {
    logger.error(`Failed to connect to RabbitMQ: ${error.message}`)
    setTimeout(connectRabbitMQ, 5000)
  }
}

const publishEvent = async (routingKey, payload) => {
  if (!channel) {
    logger.error('Cannot publish event: RabbitMQ channel not initialized')
    throw new Error('RabbitMQ channel not initialized')
  }

  try {
    const buffer = Buffer.from(JSON.stringify(payload))
    channel.publish(EXCHANGE_NAME, routingKey, buffer, {
      persistent: true,
      contentType: 'application/json'
    })
    logger.info(`Published event [${routingKey}]: ${JSON.stringify(payload)}`)
  } catch (error) {
    logger.error(`Error publishing event [${routingKey}]: ${error.message}`)
    throw error
  }
}

const consumeEvent = async (queueName, routingKeys, handler) => {
  if (!channel) {
    logger.error('Cannot consume event: RabbitMQ channel not initialized')
    throw new Error('RabbitMQ channel not initialized')
  }

  try {
    await channel.assertQueue(queueName, { durable: true })

    for (const key of routingKeys) {
      await channel.bindQueue(queueName, EXCHANGE_NAME, key)
    }

    channel.consume(queueName, async msg => {
      if (!msg) return

      try {
        const content = JSON.parse(msg.content.toString())
        logger.info(
          `Received event [${msg.fields.routingKey}]: ${JSON.stringify(
            content
          )}`
        )
        await handler(content, msg.fields.routingKey)
        channel.ack(msg)
      } catch (error) {
        logger.error(
          `Error processing event [${msg.fields.routingKey}]: ${error.message}`
        )
        channel.nack(msg, false, false) // don't requeue — send to DLQ if configured, else drop
      }
    })

    logger.info(
      `Consuming queue [${queueName}] bound to keys: ${routingKeys.join(', ')}`
    )
  } catch (error) {
    logger.error(
      `Error setting up consumer for [${queueName}]: ${error.message}`
    )
    throw error
  }
}

module.exports = { connectRabbitMQ, publishEvent, consumeEvent }
