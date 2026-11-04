const mongoose = require('mongoose')

const scheduleHistorySchema = new mongoose.Schema(
  {
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lecture',
      required: true,
    },
    subject: { type: String, required: true },
    roomName: { type: String, required: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['Created', 'Rescheduled', 'Cancelled'],
      required: true,
    },
    previousDate: { type: String, default: '' },
    previousStartTime: { type: String, default: '' },
    previousEndTime: { type: String, default: '' },
    newDate: { type: String, default: '' },
    newStartTime: { type: String, default: '' },
    newEndTime: { type: String, default: '' },
    reason: { type: String, default: '' },
  },
  { timestamps: true },
)

module.exports = mongoose.model('ScheduleHistory', scheduleHistorySchema)