// routes/api.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.session.userId;

  // Основная информация
  const user = db.prepare(`
    SELECT id, username, avatar_url, created_at 
    FROM users 
    WHERE id = ?
  `).get(userId);

  // Статистика
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM poll_proposals WHERE proposer_id = ? AND status = 'pending') AS pending_proposals,
      (SELECT COUNT(*) FROM poll_proposals WHERE proposer_id = ? AND status = 'approved') AS approved_proposals,
      (SELECT COUNT(*) FROM poll_proposals WHERE proposer_id = ?) AS total_proposals,
      (SELECT COUNT(*) FROM votes WHERE user_id = ?) AS total_votes,
      (SELECT COUNT(*) FROM room_members WHERE user_id = ?) AS total_rooms
  `).get(userId, userId, userId, userId, userId);

  // Самая активная комната (по количеству голосов)
  const activeRoom = db.prepare(`
    SELECT r.name, COUNT(v.poll_id) as vote_count
    FROM votes v
    JOIN polls p ON v.poll_id = p.id
    JOIN rooms r ON p.room_id = r.id
    WHERE v.user_id = ?
    GROUP BY r.id
    ORDER BY vote_count DESC
    LIMIT 1
  `).get(userId);

  // === История активности ===
  const activity = [];

  // 1. Предложение одобрено
  const approvedNotifs = db.prepare(`
    SELECT n.created_at, r.name AS room_name
    FROM notifications n
    JOIN rooms r ON n.room_id = r.id
    WHERE n.target_user_id = ? AND n.type = 'approved' AND n.read = 1
    ORDER BY n.created_at DESC
    LIMIT 10
  `).all(userId);

  approvedNotifs.forEach(n => {
    activity.push({
      type: 'approved',
      icon: '✅',
      text: `Ваше предложение одобрено в «${n.room_name}»`,
      time: n.created_at
    });
  });

  // 2. Пользователь предложил голосование
  const submittedProps = db.prepare(`
    SELECT pp.created_at, r.name AS room_name
    FROM poll_proposals pp
    JOIN rooms r ON pp.room_id = r.id
    WHERE pp.proposer_id = ?
    ORDER BY pp.created_at DESC
    LIMIT 10
  `).all(userId);

  submittedProps.forEach(p => {
    activity.push({
      type: 'submitted',
      icon: '💡',
      text: `Вы предложили голосование в «${p.room_name}»`,
      time: p.created_at
    });
  });

  // 3. Пользователь проголосовал
  const votes = db.prepare(`
    SELECT v.voted_at, r.name AS room_name
    FROM votes v
    JOIN polls p ON v.poll_id = p.id
    JOIN rooms r ON p.room_id = r.id
    WHERE v.user_id = ?
    ORDER BY v.voted_at DESC
    LIMIT 10
  `).all(userId);

  votes.forEach(v => {
    activity.push({
      type: 'vote',
      icon: '🗳️',
      text: `Вы проголосовали в «${v.room_name}»`,
      time: v.voted_at
    });
  });

  // Сортируем: новые — сверху
  activity.sort((a, b) => new Date(b.time) - new Date(a.time));

  // Отправляем всё вместе
  res.json({
    ...user,
    stats: {
      ...stats,
      approval_rate: stats.total_proposals > 0 
        ? Math.round((stats.approved_proposals / stats.total_proposals) * 100) 
        : 0,
      active_room: activeRoom ? activeRoom.name : '—'
    },
    activity  // <-- добавлено!
  });
});

module.exports = router;
