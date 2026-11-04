const express = require('express')
const mongoose = require('mongoose')
const Notification = require('../models/Notification')
const requireAuth = require('../middleware/auth')

const router = express.Router()

router.use(requireAuth)

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
    }).sort({ createdAt: -1 })

    res.json(notifications)
  } catch (error) {
    res.status(500).json({ message: 'Could not load notifications.' })
  }
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid notification ID.' })
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { isRead: true },
      { new: true },
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notification was not found.' })
    }

    res.json(notification)
  } catch (error) {
    res.status(500).json({ message: 'Could not update the notification.' })
  }
})

module.exports = router