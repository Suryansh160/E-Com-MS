const Joi = require('joi')

const createProductSchema = Joi.object({
  name: Joi.string().trim().required(),
  price: Joi.number().min(0).required(),
  totalStock: Joi.number().integer().min(0).required()
})

module.exports = { createProductSchema }
