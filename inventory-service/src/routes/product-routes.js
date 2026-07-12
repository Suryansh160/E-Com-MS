const express = require('express')
const router = express.Router()
const { createProduct, getProducts, getProductById } = require('../controllers/product-controller')

router.post('/add', createProduct)
router.get('/get', getProducts)
router.get('/get/:productId', getProductById)

module.exports = router
