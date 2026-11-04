const jwt = require('jsonwebtoken')

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization
  const [scheme, token] = authorization ? authorization.split(' ') : []

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please log in to continue.' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    }

    next()
  } catch {
    return res.status(401).json({
      message: 'Your session expired. Please log in again.',
    })
  }
}

module.exports = requireAuth