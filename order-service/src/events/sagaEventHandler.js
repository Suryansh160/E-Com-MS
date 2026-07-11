const Order = require('../models/order-model')
const logger = require('../utils/logger')
const { publishEvent } = require('../utils/rabbitmq')

const handleSagaEvent = async (payload, routingKey) => {
  const { orderId } = payload

  const order = await Order.findById(orderId)
  if (!order) {
    logger.error(`Received [${routingKey}] for unknown order: ${orderId}`)
  }

  switch (routingKey) {
    case 'inventory.reserved':
      order.inventoryStatus = 'reserved'
      break

    case 'inventory.reservation_failed':
      order.inventoryStatus = 'failed'
      break

    case 'payment.completed':
      order.paymentStatus = 'completed'
      break

    case 'payment.failed':
      order.paymentStatus = 'failed'
      break

    default:
      logger.warn(`Unhandled routing key in sagaEventHandler: ${routingKey}`)
      return
  }

  if (
    order.inventoryStatus === 'reserved' &&
    order.paymentStatus === 'completed'
  ) {
    order.status = 'confirmed'
    await order.save()
    logger.info(`Order ${orderId} confirmed`)
    await publishEvent('order.confirmed', {
      orderId: order._id.toString(),
      userId: order.userId
    })
  } else if (
    order.inventoryStatus === 'failed' ||
    order.paymentStatus === 'failed'
  ) {
    order.status = 'failed'
    await order.save()
    logger.info(
      `Order ${orderId} failed (inventory: ${order.inventoryStatus}, payment: ${order.paymentStatus})`
    )
    await publishEvent('order.cancelled', {
      orderId: order._id.toString(),
      userId: order.userId
    })
  } else {
    await order.save()
    logger.info(
      `Order ${orderId} updated, still pending (inventory: ${order.inventoryStatus}, payment: ${order.paymentStatus})`
    )
  }
}

module.exports = handleSagaEvent
