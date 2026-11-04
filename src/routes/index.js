const express = require('express')
const router = express.Router()
const Room = require('../models/Room')
const Booking = require('../models/Booking')
const Lecture = require('../models/Lecture')
const requireAuth = require('../middleware/auth')

// GET /api/rooms
// Optional filters: ?date=YYYY-MM-DD&startTime=HH:mm&endTime=HH:mm
router.get('/rooms', async (req, res) => {
  try {
    const { date, startTime, endTime } = req.query
    const hasTimeFilter = date || startTime || endTime

    if (hasTimeFilter && !(date && startTime && endTime)) {
      return res.status(400).json({
        message: 'Provide a date, start time, and end time together.',
      })
    }

    if (hasTimeFilter && endTime <= startTime) {
      return res.status(400).json({
        message: 'The end time must be later than the start time.',
      })
    }

    // Include existing rooms without isActive, and exclude deactivated rooms.
    const rooms = await Room.find({ isActive: { $ne: false } }).sort({ name: 1 })
    const busyRoomIds = new Set()

    if (hasTimeFilter) {
      const timeOverlap = {
        date,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      }

      const lectures = await Lecture.find({
        ...timeOverlap,
        status: 'Scheduled',
      }).select('room')

      const bookings = await Booking.find({
        ...timeOverlap,
        status: { $in: ['Pending', 'Approved'] },
      }).select('room')

      lectures.forEach((lecture) => busyRoomIds.add(lecture.room.toString()))
      bookings.forEach((booking) => busyRoomIds.add(booking.room.toString()))
    }

    res.json(
      rooms.map((room) => {
        const isBusy = busyRoomIds.has(room._id.toString())
        const status =
          room.status === 'Available' && isBusy ? 'Reserved' : room.status

        return {
          id: room._id.toString(),
          name: room.name,
          building: room.building,
          capacity: room.capacity,
          facilities: room.facilities,
          status,
        }
      }),
    )
  } catch (error) {
    res.status(500).json({ message: 'Could not load classrooms.' })
  }
})

// GET /api/bookings — the signed-in user's requests
router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({
      requestedBy: req.user.id,
    }).sort({ createdAt: -1 })

    res.json(bookings)
  } catch (error) {
    res.status(500).json({ message: 'Could not load booking requests.' })
  }
})

// POST /api/bookings — create a request for the signed-in user
router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { roomName, date, startTime, endTime, purpose } = req.body

    if (!roomName || !date || !startTime || !endTime || !purpose) {
      return res.status(400).json({
        message: 'Please provide the room, date, times, and purpose.',
      })
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        message: 'The end time must be later than the start time.',
      })
    }

    const room = await Room.findOne({
      name: roomName,
      isActive: { $ne: false },
    })

    if (!room) {
      return res.status(404).json({ message: 'That active classroom was not found.' })
    }

    if (room.status !== 'Available') {
      return res.status(409).json({
        message: `${room.name} is not currently available.`,
      })
    }

    const timeOverlap = {
      room: room._id,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }

    const bookingConflict = await Booking.findOne({
      ...timeOverlap,
      status: { $in: ['Pending', 'Approved'] },
    })

    const lectureConflict = await Lecture.findOne({
      ...timeOverlap,
      status: 'Scheduled',
    })

    if (bookingConflict || lectureConflict) {
      return res.status(409).json({
        message: 'That room already has a lecture or booking during this time.',
      })
    }

    const booking = await Booking.create({
      room: room._id,
      roomName,
      date,
      startTime,
      endTime,
      purpose,
      status: 'Pending',
      requestedBy: req.user.id,
    })

    res.status(201).json({
      message: 'Booking request submitted for admin approval.',
      booking: {
        id: booking._id.toString(),
        roomName: booking.roomName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        purpose: booking.purpose,
        status: booking.status,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Could not submit the booking request.' })
  }
})

module.exports = router