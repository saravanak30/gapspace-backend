const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const router = express.Router()

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  )
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: 'Name, email, and password are required.',
      })
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ message: 'Enter a valid email address.' })
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: 'Password must be between 8 and 72 characters.',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await User.findOne({ email: normalizedEmail })

    if (existingUser) {
      return res.status(409).json({ message: 'That email is already registered.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'student',
    })

    res.status(201).json({
      message: 'Account created successfully.',
      token: createToken(user),
      user: publicUser(user),
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'That email is already registered.' })
    }

    res.status(500).json({ message: 'Could not create the account.' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      })
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select('+passwordHash')

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    res.json({
      message: 'Login successful.',
      token: createToken(user),
      user: publicUser(user),
    })
  } catch (error) {
    res.status(500).json({ message: 'Could not log in.' })
  }
})

module.exports = router