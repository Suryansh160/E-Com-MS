const Order = require('../models/order-model')
const logger = require('../utils/logger')
const { publishEvent } = require('../utils/rabbitmq')
const redisClient = require('../utils/redisClient')
const { createOrderSchema } = require('../utils/validator')
const axios = require('axios')

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
  try {    
    const response = await axios.get(
      `${process.env.INVENTORY_SERVICE_URL}/v1/products/get/${productId}`
    )

    if (!response.data.success || !response.data.product) {
      throw new Error(`Product ${productId} not found`)
    }

    return response.data.product.price
  } catch (error) {
    logger.error(
      `Error fetching price for product ${productId}: ${error.message}`
    )
    throw new Error(`Unable to fetch price for product ${productId}`)
  }
}

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.headers['x-user-id']
    const cacheKey = `order:${id}`

    const cachedOrder = await redisClient.get(cacheKey)
    if (cachedOrder) {
      const order = JSON.parse(cachedOrder)
      if (order.userId !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      logger.info(`Order ${id} fetched from cache`)
      return res.status(200).json({ success: true, order })
    }

    const order = await Order.findById(id)
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' })
    }
    if (order.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    await redisClient.setex(cacheKey, 300, JSON.stringify(order)) // 5 min TTL

    return res.status(200).json({ success: true, order })
  } catch (error) {
    if (error.name === 'CastError') {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid order ID format' })
    }
    logger.error(`Error fetching order: ${error.message}`)
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' })
  }
}

const getOrders = async (req, res) => {
  try {
    const userId = req.headers['x-user-id']

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const [orders, totalOrders] = await Promise.all([
      Order.find({ userId })
        .sort({ createdAt: -1 }) // newest first
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ userId })
    ])

    return res.status(200).json({
      success: true,
      orders
    })
  } catch (error) {
    logger.error(`Error fetching orders: ${error.message}`)
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

module.exports = { createOrder, getOrderById, getOrders }
