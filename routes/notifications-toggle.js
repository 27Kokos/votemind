// routes/notifications-toggle.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.post('/toggle-notifications', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { enabled } = req.body;
  const value = enabled ? 1 : 0;

  db.prepare('UPDATE users SET notifications_enabled = ? WHERE id = ?').run(value, req.session.userId);
  res.json({ success: true });
});

module.exports = router;
