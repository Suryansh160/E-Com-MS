const express = require('express')
const router = express.Router()
const { createOrder } = require('../controllers/order-controllers')

router.post('/createOrder', createOrder)

module.exports = router
