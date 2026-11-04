const mongoose = require('mongoose')

const lectureSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    roomName: { type: String, required: true },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ['Scheduled', 'Cancelled'],
      default: 'Scheduled',
    },
    changeReason: { type: String, default: '' },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Lecture', lectureSchema)