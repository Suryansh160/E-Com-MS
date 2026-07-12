const express = require('express')
const router = express.Router()
const {
  createOrder,
  getOrderById,
  getOrders
} = require('../controllers/order-controllers')

router.post('/createOrder', createOrder)
router.get('/get/:id', getOrderById)
router.get('/get', getOrders)

module.exports = router
