const logger = require('../utils/logger')
const { publishEvent } = require('../utils/rabbitmq')

const handleOrderCreated = async payload => {
  const { orderId, totalAmount } = payload

  await new Promise(resolve => setTimeout(resolve, 1000))

  const isSuccess = Math.random() < 0.8

  if (isSuccess) {
    logger.info(`Payment succeeded for order ${orderId}`)
    await publishEvent('payment.completed', { orderId, amount: totalAmount })
  } else {
    logger.info(`Payment failed for order ${orderId}`)
    await publishEvent('payment.failed', {
      orderId,
      reason: 'Payment declined (simulated)'
    })
  }
}

module.exports = handleOrderCreated
