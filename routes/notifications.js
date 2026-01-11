// routes/notifications.js
const express = require('express');
const db = require('../db');
const router = express.Router();

// Получить уведомления
// Поддержка:
// - /notifications?roomId=1 → уведомления из одной комнаты
// - /notifications → уведомления из всех комнат пользователя
router.get('/', (req, res) => {
  const { roomId: rawRoomId } = req.query;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Не авторизован');
  }

  let notifications = [];

  if (rawRoomId) {
    // Уведомления из конкретной комнаты
    const roomId = Number(rawRoomId);
    if (isNaN(roomId)) {
      return res.status(400).send('roomId должен быть числом');
    }

    const isMember = db.prepare(`
      SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?
    `).get(roomId, userId);

    if (!isMember) {
      return res.status(403).send('Вы не состоите в этой комнате');
    }

    notifications = db.prepare(`
      SELECT n.*, u.username, r.name AS room_name
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      JOIN rooms r ON n.room_id = r.id
      WHERE n.room_id = ? AND n.target_user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 20
    `).all(roomId, userId);
  } else {
    // Уведомления из всех комнат, где состоит пользователь
    notifications = db.prepare(`
      SELECT n.*, u.username, r.name AS room_name
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      JOIN rooms r ON n.room_id = r.id
      WHERE n.target_user_id = ?
        AND n.room_id IN (SELECT room_id FROM room_members WHERE user_id = ?)
      ORDER BY n.created_at DESC
      LIMIT 20
    `).all(userId, userId);
  }

  res.json(notifications);
});

// Отметить как прочитанное
router.post('/:id/read', async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Не авторизован');
  }

  const notif = db.prepare(`
    SELECT 1 FROM notifications
    WHERE id = ? AND target_user_id = ?
  `).get(id, userId);

  if (!notif) {
    return res.status(403).send('Нет прав');
  }

  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
  res.sendStatus(200);
});

// Отметить все как прочитанные
router.post('/read-all', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Не авторизован');
  }

  db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE target_user_id = ? AND read = 0
  `).run(userId);
  res.sendStatus(200);
});

module.exports = router;
