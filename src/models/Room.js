const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    building: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    facilities: [{ type: String }],
    status: {
      type: String,
      enum: ['Available', 'Occupied', 'Reserved'],
      default: 'Available',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Room', roomSchema)