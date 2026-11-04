const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['booking_update', 'schedule_change'],
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lecture',
      default: null,
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Notification', notificationSchema)