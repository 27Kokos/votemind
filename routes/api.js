// routes/api.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = db.prepare(`
    SELECT id, username, avatar_url, created_at 
    FROM users 
    WHERE id = ?
  `).get(req.session.userId);

  res.json(user);
});

module.exports = router;
