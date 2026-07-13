const Product = require('../models/product')
const logger = require('../utils/logger')
const { publishEvent } = require('../utils/rabbitmq')

const handleOrderCreated = async payload => {
  const { orderId, items } = payload

  try {
    for (const item of items) {
      const product = await Product.findOneAndUpdate(
        {
          productId: item.productId,
          $expr: {
            $gte: [
              { $subtract: ['$totalStock', '$reservedStock'] },
              item.quantity
            ]
          }
        },
        { $inc: { reservedStock: item.quantity } },
        { new: true }
      )

      if (!product) {
        logger.warn(
          `Reservation failed for order ${orderId}, product ${item.productId}`
        )
        await publishEvent('inventory.reservation_failed', {
          orderId,
          reason: `Insufficient stock for ${item.productId}`
        })
      }
    }

    logger.info(`Inventory reserved for order ${orderId}`)
    await publishEvent('inventory.reserved', { orderId })
  } catch (error) {
    logger.error(
      `Error handling order.created for ${orderId}: ${error.message}`
    )
    await publishEvent('inventory.reservation_failed', {
      orderId,
      reason: 'Internal error during reservation'
    })
  }
}

module.exports = handleOrderCreated
