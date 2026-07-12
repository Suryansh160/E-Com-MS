const crypto = require('crypto')
const Product = require('../models/product')
const logger = require('../utils/logger')
const { createProductSchema } = require('../utils/product-validator')

const generateProductId = () => {
  return `PROD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

const createProduct = async (req, res) => {
  logger.info('Create product endpoint hit')
  try {
    const { error, value } = createProductSchema.validate(req.body)
    if (error) {
      logger.warn(`Product validation failed: ${error.details[0].message}`)
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }

    const { name, price, totalStock } = value

    const product = new Product({
      productId: generateProductId(),
      name,
      price,
      totalStock,
      reservedStock: 0
    })

    await product.save()
    logger.info(`Product created: ${product.productId}`)

    return res.status(201).json({
      success: true,
      product
    })
  } catch (error) {
    if (error.code === 11000) {
      logger.warn('productId collision, this should be rare')
      return res.status(409).json({
        success: false,
        message: 'ID collision, please retry'
      })
    }
    logger.error(`Error creating product: ${error.message}`)
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

const getProducts = async (req, res) => {
  logger.info('Get all products endpoint hit')
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const [products, totalProducts] = await Promise.all([
      Product.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments({})
    ])

    return res.status(200).json({
      success: true,
      products
    })
  } catch (error) {
    logger.error(`Error fetching products: ${error.message}`)
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

const getProductById = async (req, res) => {
  logger.info('Get product by id endpoint hit')
  try {
    const { productId } = req.params

    const product = await Product.findOne({ productId })

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    return res.status(200).json({
      success: true,
      product
    })
  } catch (error) {
    logger.error(`Error fetching product: ${error.message}`)
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

module.exports = { createProduct, getProducts, getProductById }
