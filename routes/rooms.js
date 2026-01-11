// routes/rooms.js
const express = require('express');
const db = require('../db');
const router = express.Router();

// Генерация уникального 6-символьного кода
function generateCode() {
  const chars = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ0123456789';
  const stmt = db.prepare('SELECT 1 FROM rooms WHERE invite_code = ?');

  let code;
  let attempts = 0;
  const maxAttempts = 50;

  while (!code && attempts < maxAttempts) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const existing = stmt.get(code);
    if (existing) {
      code = null;
    }
    attempts++;
  }

  if (!code) {
    throw new Error('Не удалось сгенерировать уникальный код');
  }

  return code;
}

// Создание комнаты
router.post('/', (req, res) => {
  const { name, description } = req.body;
  const ownerId = req.session.userId;

  if (!name || !ownerId) {
    return res.status(400).send('Не хватает данных');
  }

  const inviteCode = generateCode();

  try {
    const result = db.prepare(`
      INSERT INTO rooms (name, description, owner_id, invite_code)
      VALUES (?, ?, ?, ?)
    `).run(name, description, ownerId, inviteCode);

    db.prepare(`
      INSERT INTO room_members (room_id, user_id) VALUES (?, ?)
    `).run(result.lastInsertRowid, ownerId);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Ошибка при создании комнаты:', err);
    res.status(500).send('Ошибка при создании комнаты');
  }
});

// Получение "моих комнат"
router.get('/my', (req, res) => {
  const userId = req.session.userId;

  const rooms = db.prepare(`
    SELECT r.id, r.name, r.description, r.invite_code,
           CASE WHEN r.owner_id = ? THEN 1 ELSE 0 END AS is_owner
    FROM rooms r
    JOIN room_members rm ON r.id = rm.room_id
    WHERE rm.user_id = ?
    ORDER BY r.created_at DESC
  `).all(userId, userId);

  res.json(rooms);
});

// Присоединение к комнате по коду
router.post('/join', (req, res) => {
  const { inviteCode } = req.body;
  const userId = req.session.userId;

  if (!inviteCode || !userId) {
    return res.status(400).send('Не хватает данных');
  }

  const room = db.prepare('SELECT id FROM rooms WHERE invite_code = ?').get(inviteCode);

  if (!room) {
    return res.status(404).send('Комната не найдена');
  }

  const member = db.prepare(`
    SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?
  `).get(room.id, userId);

  if (member) {
    return res.redirect('/dashboard');
  }

  try {
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)')
      .run(room.id, userId);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Ошибка при присоединении к комнате:', err);
    res.status(500).send('Ошибка при присоединении');
  }
});

// Получение данных комнаты
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  const room = db.prepare(`
    SELECT r.*, 
           CASE WHEN r.owner_id = ? THEN 1 ELSE 0 END AS is_owner
    FROM rooms r
    WHERE r.id = ?
  `).get(userId, id);

  if (!room) {
    return res.status(404).send('Комната не найдена');
  }

  res.json(room);
});

module.exports = router;
