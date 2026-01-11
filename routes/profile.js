// routes/profile.js
const express = require('express');
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Настройка загрузки
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.session.userId;
    const ext = path.extname(file.originalname);
    cb(null, `user_${userId}${ext}`);
  }
});

const upload = multer({ storage });

// GET /profile — отправляем HTML
router.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'profile.html'));
});

// POST /profile/avatar — загрузка аватарки
router.post('/avatar', upload.single('avatar'), (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Не авторизован');
  }

  if (!req.file) {
    return res.status(400).send('Файл не загружен');
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.session.userId);
  req.session.avatarUrl = avatarUrl;

  res.redirect('/profile');
});

module.exports = router;
