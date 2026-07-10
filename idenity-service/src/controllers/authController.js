const User = require('../models/User')
const logger = require('../utils/logger')
const generateTokens = require('../utils/generateTokens')
const { validateRegistration } = require('../utils/validation')

async function register (req, res) {
  logger.info('Register endpoint hit...')
  try {
    const { error } = validateRegistration(req.body)

    if (error) {
      logger.warn('Validation error', { error: error.details[0].message })
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }

    const { username, email, password } = req.body

    const existingUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existingUser) {
      logger.warn('User already exists')
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      })
    }

    const user = new User({ username, email, password })
    await user.save()
    logger.info('User saved successfully', { userId: user._id })

    const { accessToken, refreshToken } = await generateTokens(user)

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken
    })
  } catch (error) {
    logger.error('Registration error occurred', { error: error.message })
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

async function login () {}

async function refreshToken () {}

async function logout () {}

module.exports = { register, login, refreshToken, logout }
