// routes/proposals.js
const express = require('express');
const db = require('../db');
const router = express.Router();

// Участник: предложить голосование
router.post('/propose', (req, res) => {
  const { roomId, question, type, options } = req.body;
  const proposerId = req.session.userId;

  if (!proposerId) {
    return res.status(401).send('Вы не авторизованы');
  }

  const roomIdNum = Number(roomId);
  if (!Number.isInteger(roomIdNum)) {
    return res.status(400).send('Неверный ID комнаты');
  }

  if (!question || !['single', 'multiple', 'rated_options'].includes(type)) {
    return res.status(400).send('Неверный вопрос или тип');
  }

  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).send('Минимум 2 варианта');
  }

  const isMember = db.prepare(`
    SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?
  `).get(roomIdNum, proposerId);

  if (!isMember) {
    return res.status(403).send('Вы не состоите в этой комнате');
  }

  const room = db.prepare('SELECT id, name, owner_id FROM rooms WHERE id = ?').get(roomIdNum);
  if (!room) {
    return res.status(404).send('Комната не найдена');
  }

  try {
    db.exec('BEGIN');

    // 1. Сохраняем предложение
    db.prepare(`
      INSERT INTO poll_proposals (room_id, proposer_id, question, type, options)
      VALUES (?, ?, ?, ?, ?)
    `).run(roomIdNum, proposerId, question, type, JSON.stringify(options));

    // 2. Отправляем уведомление владельцу
    db.prepare(`
      INSERT INTO notifications (room_id, target_user_id, actor_id, type, title)
      VALUES (?, ?, ?, 'new_proposal', '💡 Новое предложение в комнату')
    `).run(roomId, room.owner_id, proposerId);

    db.exec('COMMIT');

    res.redirect(`/room/${roomIdNum}`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Ошибка при предложении:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Владелец: получить все нерассмотренные предложения
router.get('/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const ownerId = req.session.userId;

  const room = db.prepare('SELECT owner_id FROM rooms WHERE id = ?').get(roomId);
  if (!room || room.owner_id !== ownerId) {
    return res.status(403).send('Только владелец может просматривать');
  }

  const proposals = db.prepare(`
    SELECT pp.*, u.username, r.name AS room_name
    FROM poll_proposals pp
    JOIN users u ON pp.proposer_id = u.id
    JOIN rooms r ON pp.room_id = r.id
    WHERE pp.room_id = ? AND pp.status = 'pending'
    ORDER BY pp.created_at DESC
  `).all(roomId);

  res.json(proposals);
});

// Владелец: одобрить предложение
router.post('/approve/:id', (req, res) => {
  const { id } = req.params;
  const ownerId = req.session.userId;

  const proposal = db.prepare(`
    SELECT pp.room_id, pp.proposer_id, pp.question, pp.type, pp.options
    FROM poll_proposals pp
    JOIN rooms r ON pp.room_id = r.id
    WHERE pp.id = ? AND r.owner_id = ?
  `).get(id, ownerId);

  if (!proposal) {
    return res.status(403).send('Нет прав или предложение не найдено');
  }

  try {
    db.exec('BEGIN');

    const poll = db.prepare(`
      INSERT INTO polls (room_id, question, type, created_by)
      VALUES (?, ?, ?, ?)
    `).run(proposal.room_id, proposal.question, proposal.type, ownerId);

    const pollId = poll.lastInsertRowid;
    const options = JSON.parse(proposal.options);
    const stmt = db.prepare('INSERT INTO poll_options (poll_id, text) VALUES (?, ?)');
    options.forEach(opt => stmt.run(pollId, opt));

    db.prepare("UPDATE poll_proposals SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

    // Уведомление участнику
    db.prepare(`
      INSERT INTO notifications (room_id, target_user_id, actor_id, type, title)
      VALUES (?, ?, ?, 'approved', '✅ Ваше предложение одобрено!')
    `).run(proposal.room_id, proposal.proposer_id, ownerId);

    db.exec('COMMIT');
    res.redirect(`/room/${proposal.room_id}`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Ошибка при одобрении:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Владелец: отклонить предложение
router.post('/reject/:id', (req, res) => {
  const { id } = req.params;
  const ownerId = req.session.userId;

  const isOwner = db.prepare(`
    SELECT 1 FROM poll_proposals pp
    JOIN rooms r ON pp.room_id = r.id
    WHERE pp.id = ? AND r.owner_id = ?
  `).get(id, ownerId);

  if (!isOwner) {
    return res.status(403).send('Нет прав');
  }

  db.prepare("UPDATE poll_proposals SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.redirect('back');
});

module.exports = router;
