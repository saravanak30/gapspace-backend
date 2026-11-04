require('dotenv').config()

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const mongoose = require('mongoose')
const Room = require('./models/Room')

const app = express()

app.use(cors())
app.use(bodyParser.json())

const routes = require('./routes')
const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const facultyRoutes = require('./routes/faculty')
const notificationRoutes = require('./routes/notifications')

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.get('/ping', (req, res) => {
  res.send('pong')
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/faculty', facultyRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api', routes)

const port = process.env.PORT || 3000

const mongoUri =
  `mongodb://${encodeURIComponent(process.env.MONGODB_USERNAME)}:` +
  `${encodeURIComponent(process.env.MONGODB_PASSWORD)}@` +
  `${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/` +
  `${process.env.MONGODB_DATABASE}`

async function startServer() {
  try {
    await mongoose.connect(mongoUri)

    const roomCount = await Room.countDocuments()

    if (roomCount === 0) {
      await Room.insertMany([
        {
          name: 'A101',
          building: 'Block A',
          capacity: 60,
          facilities: ['Projector', 'Wi-Fi'],
          status: 'Occupied',
        },
        {
          name: 'B202',
          building: 'Block B',
          capacity: 45,
          facilities: ['Projector', 'Wi-Fi'],
          status: 'Available',
        },
        {
          name: 'C303',
          building: 'Block C',
          capacity: 30,
          facilities: ['Whiteboard', 'Wi-Fi'],
          status: 'Available',
        },
        {
          name: 'D104',
          building: 'Block D',
          capacity: 40,
          facilities: ['Projector', 'Whiteboard'],
          status: 'Reserved',
        },
      ])
    }

    console.log('MongoDB connected')

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`)
    })
  } catch (error) {
    console.error('Server startup error:', error.message)
  }
}

startServer()