const express = require('express')
const mongoose = require('mongoose')
const Booking = require('../models/Booking')
const Lecture = require('../models/Lecture')
const Room = require('../models/Room')
const User = require('../models/User')
const Notification = require('../models/Notification')
const requireAuth = require('../middleware/auth')

const router = express.Router()

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access is required.' })
  }

  next()
}

// GET /api/admin/bookings
router.get('/bookings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate('requestedBy', 'name email')
      .populate('room', 'name building')

    res.json(bookings)
  } catch (error) {
    res.status(500).json({ message: 'Could not load booking requests.' })
  }
})

// PATCH /api/admin/bookings/:id/status
router.patch(
  '/bookings/:id/status',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { status } = req.body

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid booking ID.' })
      }

      if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({
          message: 'Status must be Approved or Rejected.',
        })
      }

      const booking = await Booking.findById(req.params.id)

      if (!booking) {
        return res.status(404).json({ message: 'Booking was not found.' })
      }

      if (status === 'Approved') {
        const conflict = await Booking.findOne({
          _id: { $ne: booking._id },
          room: booking.room,
          date: booking.date,
          status: { $in: ['Pending', 'Approved'] },
          startTime: { $lt: booking.endTime },
          endTime: { $gt: booking.startTime },
        })

        if (conflict) {
          return res.status(409).json({
            message: 'Another booking overlaps this time slot.',
          })
        }
      }

      booking.status = status
      await booking.save()

      if (booking.requestedBy) {
        await Notification.create({
          recipient: booking.requestedBy,
          title: `Booking ${status.toLowerCase()}`,
          message: `Your request for ${booking.roomName} on ${booking.date} was ${status.toLowerCase()}.`,
          type: 'booking_update',
          booking: booking._id,
        })
      }

      res.json({
        message: `Booking ${status.toLowerCase()}.`,
        booking,
      })
    } catch (error) {
      res.status(500).json({ message: 'Could not update the booking.' })
    }
  },
)

// GET /api/admin/rooms
router.get('/rooms', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ name: 1 })
    res.json(rooms)
  } catch (error) {
    res.status(500).json({ message: 'Could not load classrooms.' })
  }
})

// POST /api/admin/rooms
router.post('/rooms', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, building, capacity, facilities } = req.body

    if (!name?.trim() || !building?.trim() || !capacity) {
      return res.status(400).json({
        message: 'Room name, building, and capacity are required.',
      })
    }

    const facilityList = Array.isArray(facilities)
      ? facilities
      : (facilities || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)

    const room = await Room.create({
      name: name.trim(),
      building: building.trim(),
      capacity: Number(capacity),
      facilities: facilityList,
      status: 'Available',
      isActive: true,
    })

    res.status(201).json({
      message: 'Classroom added.',
      room,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A classroom with that name already exists.',
      })
    }

    res.status(500).json({ message: 'Could not add the classroom.' })
  }
})

// PATCH /api/admin/rooms/:id
router.patch('/rooms/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { name, building, capacity, facilities } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid classroom ID.' })
    }

    if (!name?.trim() || !building?.trim() || !Number(capacity)) {
      return res.status(400).json({
        message: 'Room name, building, and capacity are required.',
      })
    }

    const facilityList = Array.isArray(facilities)
      ? facilities
      : (facilities || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)

    const room = await Room.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        building: building.trim(),
        capacity: Number(capacity),
        facilities: facilityList,
      },
      { new: true, runValidators: true },
    )

    if (!room) {
      return res.status(404).json({ message: 'Classroom was not found.' })
    }

    res.json({ message: 'Classroom updated.', room })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A classroom with that name already exists.',
      })
    }

    res.status(500).json({ message: 'Could not update the classroom.' })
  }
})

// PATCH /api/admin/rooms/:id/active
router.patch(
  '/rooms/:id/active',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params
      const { isActive } = req.body

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid classroom ID.' })
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          message: 'isActive must be true or false.',
        })
      }

      const room = await Room.findById(id)

      if (!room) {
        return res.status(404).json({ message: 'Classroom was not found.' })
      }

      if (!isActive) {
        const [booking, lecture] = await Promise.all([
          Booking.findOne({
            room: room._id,
            status: { $in: ['Pending', 'Approved'] },
          }),
          Lecture.findOne({
            room: room._id,
            status: 'Scheduled',
          }),
        ])

        if (booking || lecture) {
          return res.status(409).json({
            message: 'This classroom has an active booking or lecture.',
          })
        }
      }

      room.isActive = isActive
      await room.save()

      res.json({
        message: isActive ? 'Classroom activated.' : 'Classroom deactivated.',
        room,
      })
    } catch (error) {
      res.status(500).json({ message: 'Could not change classroom status.' })
    }
  },
)

// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('name email role createdAt')
      .sort({ name: 1 })

    res.json(users)
  } catch (error) {
    res.status(500).json({ message: 'Could not load users.' })
  }
})

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body
    const allowedRoles = ['student', 'faculty', 'admin']

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID.' })
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: 'Role must be student, faculty, or admin.',
      })
    }

    if (id === req.user.id && role !== 'admin') {
      return res.status(400).json({
        message: 'You cannot remove your own admin role here.',
      })
    }

    const user = await User.findById(id)

    if (!user) {
      return res.status(404).json({ message: 'User was not found.' })
    }

    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' })

      if (adminCount <= 1) {
        return res.status(409).json({
          message: 'At least one admin account must remain.',
        })
      }
    }

    user.role = role
    await user.save()

    res.json({
      message: 'User role updated.',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Could not update the user role.' })
  }
})

// GET /api/admin/lectures
router.get('/lectures', requireAuth, requireAdmin, async (req, res) => {
  try {
    const lectures = await Lecture.find()
      .sort({ date: 1, startTime: 1 })
      .populate('faculty', 'name email')
      .populate('room', 'name building')

    res.json(lectures)
  } catch (error) {
    res.status(500).json({ message: 'Could not load lectures.' })
  }
})

// POST /api/admin/lectures
router.post('/lectures', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subject, roomName, facultyEmail, date, startTime, endTime } = req.body

    if (!subject || !roomName || !facultyEmail || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: 'Please fill in all lecture details.',
      })
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        message: 'The end time must be later than the start time.',
      })
    }

    const room = await Room.findOne({ name: roomName, isActive: { $ne: false } })

    if (!room) {
      return res.status(404).json({ message: 'Active classroom was not found.' })
    }

    const faculty = await User.findOne({
      email: facultyEmail.trim().toLowerCase(),
      role: { $in: ['faculty', 'admin'] },
    })

    if (!faculty) {
      return res.status(404).json({
        message: 'Faculty account was not found. The account must have a faculty role.',
      })
    }

    const lectureConflict = await Lecture.findOne({
      room: room._id,
      date,
      status: 'Scheduled',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    })

    const bookingConflict = await Booking.findOne({
      room: room._id,
      date,
      status: { $in: ['Pending', 'Approved'] },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    })

    if (lectureConflict || bookingConflict) {
      return res.status(409).json({
        message: 'That room already has a lecture or booking during this time.',
      })
    }

    const lecture = await Lecture.create({
      subject: subject.trim(),
      room: room._id,
      roomName: room.name,
      faculty: faculty._id,
      date,
      startTime,
      endTime,
    })

    res.status(201).json({
      message: 'Lecture added to the timetable.',
      lecture,
    })
  } catch (error) {
    res.status(500).json({ message: 'Could not create the lecture.' })
  }
})

module.exports = router