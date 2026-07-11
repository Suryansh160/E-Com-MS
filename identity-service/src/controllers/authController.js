const User = require('../models/User')
const logger = require('../utils/logger')
const generateTokens = require('../utils/generateTokens')
const { validateRegistration, validateLogin } = require('../utils/validation')
const argon2 = require('argon2')
const RefreshToken = require('../models/RefreshToken')

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

const LOGIN_CACHE_TTL = 300

async function login (req, res) {
  logger.info('Login endpoint hit...')
  try {
    const { error } = validateLogin(req.body)

    if (error) {
      logger.warn('Validation error', { error: error.details[0].message })
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }

    const { email, password } = req.body
    const cacheKey = `user:email:${email}`

    let user
    const cachedUser = await req.redisClient.get(cacheKey)

    if (cachedUser) {
      logger.info('User fetched from cache')
      user = JSON.parse(cachedUser)
    } else {
      user = await User.findOne({ email })
      if (user) {
        await req.redisClient.setex(
          cacheKey,
          LOGIN_CACHE_TTL,
          JSON.stringify(user)
        )
      }
    }

    if (!user) {
      logger.warn('Invalid user')
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    const isValidPassword = await argon2.verify(user.password, password)
    if (!isValidPassword) {
      logger.warn('Invalid password')
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    const { accessToken, refreshToken } = await generateTokens(user)

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken
    })
  } catch (error) {
    logger.error('Login error occurred', { error: error.message })
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

const USER_CACHE_TTL = 300

async function refreshToken (req, res) {
  logger.info('Refresh token endpoint hit...')

  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      logger.warn('Refresh token missing')
      return res.status(400).json({
        success: false,
        message: 'Refresh token is missing'
      })
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken })

    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn('Invalid or expired refresh token')
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      })
    }

    const cacheKey = `user:id:${storedToken.user}`

    let user
    const cachedUser = await req.redisClient.get(cacheKey)

    if (cachedUser) {
      logger.info('User fetched from cache')
      user = JSON.parse(cachedUser)
    } else {
      user = await User.findById(storedToken.user)
      if (user) {
        await req.redisClient.setex(
          cacheKey,
          USER_CACHE_TTL,
          JSON.stringify(user)
        )
      }
    }

    if (!user) {
      logger.warn('User not found for refresh token')
      return res.status(401).json({
        success: false,
        message: 'User not found'
      })
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      user
    )

    await RefreshToken.deleteOne({ _id: storedToken._id })

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    })
  } catch (error) {
    logger.error('Refresh token error occurred', { error: error.message })
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

async function logout (req, res) {
  logger.info('Logout endpoint hit...')

  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      logger.warn('Refresh token missing')
      return res.status(400).json({
        success: false,
        message: 'Refresh token is missing'
      })
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken })

    await RefreshToken.deleteOne({ token: refreshToken })

    if (storedToken) {
      await req.redisClient.del(`user:id:${storedToken.user}`)
      logger.info('User cache invalidated on logout')
    }

    logger.info('Refresh token deleted for logout')

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    logger.error('Logout error occurred', {
      error: error.message,
      stack: error.stack
    })
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}
module.exports = { register, login, refreshToken, logout }
