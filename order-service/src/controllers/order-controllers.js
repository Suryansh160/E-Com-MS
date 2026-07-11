const Order = require('../models/order-model')
const logger = require('../utils/logger')
const { publishEvent } = require('../utils/rabbitmq')
const { createOrderSchema } = require('../utils/validator')

const createOrder = async (req, res) => {
  try {
    const { error, value } = createOrderSchema.validate(req.body)

    if (error) {
      logger.warn(`Order validation failed: ${error.details[0].message}`)
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }

    const { items } = value
    const userId = req.headers['x-user-id']

    if (!userId) {
      logger.warn('createOrder called without x-user-id header')
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user identity missing'
      })
    }

    const enrichedItems = await Promise.all(
      items.map(async item => {
        const priceAtPurchase = await getProductPrice(item.productId)
        return {
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase
        }
      })
    )

    const totalAmount = enrichedItems.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0
    )

    const order = new Order({
      userId,
      items: enrichedItems,
      totalAmount,
      status: 'pending',
      inventoryStatus: 'pending',
      paymentStatus: 'pending'
    })

    await order.save()
    logger.info(`Order created: ${order._id} for user ${userId}`)

    await publishEvent('order.created', {
      orderId: order._id.toString(),
      userId: order.userId,
      items: order.items.map(({ productId, quantity }) => ({
        productId,
        quantity
      })),
      totalAmount: order.totalAmount
    })

    return res.status(201).json({
      success: true,
      order
    })
  } catch (error) {
    logger.error(`Error creating order: ${error.message}`)
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

const getProductPrice = async productId => {
  return 100
}

module.exports = { createOrder }
