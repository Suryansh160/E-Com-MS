const Joi = require('joi')

const validateRegistration = data => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(50).trim().required(),

    email: Joi.string().email().trim().lowercase().required(),

    password: Joi.string().min(6).max(100).required()
  })

  return schema.validate(data)
}

function validateLogin (data) {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  })

  return schema.validate(data)
}
module.exports = { validateRegistration, validateLogin }
