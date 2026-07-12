const mongoose = require('mongoose')

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    totalStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    reservedStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  },
  {
    timestamps: true
  }
)

productSchema.virtual('availableStock').get(function () {
  return this.totalStock - this.reservedStock
})

productSchema.set('toJSON', { virtuals: true })
productSchema.set('toObject', { virtuals: true })

module.exports = mongoose.model('Product', productSchema)
