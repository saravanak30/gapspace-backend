const express = require('express')
const mongoose = require('mongoose')
const Lecture = require('../models/Lecture')
const Booking = require('../models/Booking')
const ScheduleHistory = require('../models/ScheduleHistory')
const requireAuth = require('../middleware/auth')

const router = express.Router()

router.use(requireAuth)

router.use((req, res, next) => {
  if (!['faculty', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Faculty access is required.' })
  }

  next()
})

function lectureFilter(req, lectureId) {
  const filter = { _id: lectureId }

  if (req.user.role !== 'admin') {
    filter.faculty = req.user.id
  }

  return filter
}

// GET /api/faculty/lectures
router.get('/lectures', async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin' ? {} : { faculty: req.user.id }

    const lectures = await Lecture.find(filter)
      .sort({ date: 1, startTime: 1 })
      .populate('faculty', 'name email')

    res.json(lectures)
  } catch (error) {
    res.status(500).json({ message: 'Could not load the timetable.' })
  }
})

// GET /api/faculty/history
router.get('/history', async (req, res) => {
  try {
    let lectureIds

    if (req.user.role === 'admin') {
      lectureIds = await Lecture.find().distinct('_id')
    } else {
      lectureIds = await Lecture.find({ faculty: req.user.id }).distinct('_id')
    }

    const history = await ScheduleHistory.find({
      lecture: { $in: lectureIds },
    })
      .sort({ createdAt: -1 })
      .populate('changedBy', 'name email')

    res.json(history)
  } catch (error) {
    res.status(500).json({ message: 'Could not load schedule history.' })
  }
})

// PATCH /api/faculty/lectures/:id/cancel
router.patch('/lectures/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lecture ID.' })
    }

    const lecture = await Lecture.findOne(lectureFilter(req, id))

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture was not found.' })
    }

    if (lecture.status !== 'Scheduled') {
      return res.status(409).json({ message: 'This lecture is not scheduled.' })
    }

    const previousDate = lecture.date
    const previousStartTime = lecture.startTime
    const previousEndTime = lecture.endTime

    lecture.status = 'Cancelled'
    lecture.changeReason = req.body.reason || 'Cancelled by faculty'
    await lecture.save()

    await ScheduleHistory.create({
      lecture: lecture._id,
      subject: lecture.subject,
      roomName: lecture.roomName,
      changedBy: req.user.id,
      action: 'Cancelled',
      previousDate,
      previousStartTime,
      previousEndTime,
      reason: lecture.changeReason,
    })

    res.json({ message: 'Lecture cancelled.', lecture })
  } catch (error) {
    res.status(500).json({ message: 'Could not cancel the lecture.' })
  }
})

// PATCH /api/faculty/lectures/:id/reschedule
router.patch('/lectures/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params
    const { date, startTime, endTime } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lecture ID.' })
    }

    if (!date || !startTime || !endTime || endTime <= startTime) {
      return res.status(400).json({
        message: 'Provide a date and valid start and end times.',
      })
    }

    const lecture = await Lecture.findOne(lectureFilter(req, id))

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture was not found.' })
    }

    if (lecture.status !== 'Scheduled') {
      return res.status(409).json({
        message: 'Only scheduled lectures can be rescheduled.',
      })
    }

    const lectureConflict = await Lecture.findOne({
      _id: { $ne: lecture._id },
      room: lecture.room,
      date,
      status: 'Scheduled',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    })

    const bookingConflict = await Booking.findOne({
      room: lecture.room,
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

    const previousDate = lecture.date
    const previousStartTime = lecture.startTime
    const previousEndTime = lecture.endTime

    lecture.date = date
    lecture.startTime = startTime
    lecture.endTime = endTime
    lecture.changeReason = 'Rescheduled by faculty'
    await lecture.save()

    await ScheduleHistory.create({
      lecture: lecture._id,
      subject: lecture.subject,
      roomName: lecture.roomName,
      changedBy: req.user.id,
      action: 'Rescheduled',
      previousDate,
      previousStartTime,
      previousEndTime,
      newDate: date,
      newStartTime: startTime,
      newEndTime: endTime,
      reason: lecture.changeReason,
    })

    res.json({ message: 'Lecture rescheduled.', lecture })
  } catch (error) {
    res.status(500).json({ message: 'Could not reschedule the lecture.' })
  }
})

module.exports = router