// routes/polls.js
const express = require('express');
const db = require('../db');
const router = express.Router();

// Все голосования в комнате
router.get('/room/:roomId', (req, res) => {
  const polls = db.prepare(`
    SELECT p.id, p.question, p.type, p.created_by,
           (SELECT COUNT(*) FROM votes v WHERE v.poll_id = p.id) AS vote_count
    FROM polls p
    WHERE p.room_id = ?
    ORDER BY p.created_at DESC
  `).all(req.params.roomId);

  polls.forEach(poll => {
    if (poll.type === 'rated_options') {
      poll.options = db.prepare(`
        SELECT o.id, o.text,
               COALESCE(AVG(v.rating), 0) AS average_rating,
               COUNT(v.option_id) AS vote_count
        FROM poll_options o
        LEFT JOIN votes v ON o.id = v.option_id AND v.poll_id = ?
        WHERE o.poll_id = ?
        GROUP BY o.id
      `).all(poll.id, poll.id);
    } else {
      poll.options = db.prepare(`
        SELECT o.id, o.text,
               (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id) AS votes
        FROM poll_options o
        WHERE o.poll_id = ?
      `).all(poll.id);
    }
  });

  res.json(polls);
});

// Создание нового голосования
router.post('/', (req, res) => {
  const { roomId, question, type, options } = req.body;
  const createdBy = req.session.userId;

  if (!['single', 'multiple', 'rated_options'].includes(type)) {
    return res.status(400).send('Неверный тип голосования');
  }

  if (!Array.isArray(options) || options.length === 0) {
    return res.status(400).send('Требуются варианты');
  }

  if ((type === 'single' || type === 'multiple') && options.length < 2) {
    return res.status(400).send('Для этого типа нужно минимум 2 варианта');
  }

  try {
    const poll = db.prepare(`
      INSERT INTO polls (room_id, question, type, created_by)
      VALUES (?, ?, ?, ?)
    `).run(roomId, question, type, createdBy);

    const pollId = poll.lastInsertRowid;

    const stmt = db.prepare('INSERT INTO poll_options (poll_id, text) VALUES (?, ?)');
    options.forEach(text => {
      if (text.trim()) {
        stmt.run(pollId, text.trim());
      }
    });

    res.status(201).json({ id: pollId });
  } catch (err) {
    console.error('Ошибка при создании голосования:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Получение одного голосования (для просмотра и редактирования)
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  const poll = db.prepare(`
    SELECT p.*, 
           CASE WHEN r.owner_id = ? THEN 1 ELSE 0 END AS is_owner
    FROM polls p
    JOIN rooms r ON p.room_id = r.id
    WHERE p.id = ?
  `).get(userId, id);

  if (!poll) {
    return res.status(404).send('Голосование не найдено');
  }

  const vote = db.prepare(`
    SELECT 1 FROM votes
    WHERE poll_id = ? AND user_id = ?
  `).get(id, userId);

  poll.user_vote = !!vote;

  if (poll.type === 'rated_options') {
    poll.options = db.prepare(`
      SELECT o.id, o.text,
             COALESCE(AVG(v.rating), 0) AS average_rating,
             COUNT(v.option_id) AS vote_count
      FROM poll_options o
      LEFT JOIN votes v ON o.id = v.option_id AND v.poll_id = ?
      WHERE o.poll_id = ?
      GROUP BY o.id
    `).all(id, id);
  } else {
    poll.options = db.prepare(`
      SELECT o.id, o.text,
             (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id) AS votes
      FROM poll_options o
      WHERE o.poll_id = ?
    `).all(id);
  }

  res.json(poll);
});


// Голосование
router.post('/:id/vote', (req, res) => {
  const { id } = req.params;
  const { optionId, ratings } = req.body;
  const userId = req.session.userId;

  const poll = db.prepare('SELECT id, type FROM polls WHERE id = ?').get(id);
  if (!poll) return res.status(404).send('Голосование не найдено');

  const hasVoted = db.prepare(`
    SELECT 1 FROM votes WHERE poll_id = ? AND user_id = ?
  `).get(id, userId);

  if (hasVoted) {
    return res.status(400).send('Вы уже проголосовали');
  }

  try {
    if (poll.type === 'rated_options') {
      Object.entries(ratings).forEach(([optId, rating]) => {
        if (rating < 1 || rating > 5) return;
        db.prepare(`
          INSERT INTO votes (poll_id, user_id, option_id, rating)
          VALUES (?, ?, ?, ?)
        `).run(id, userId, optId, rating);
      });
    } else {
      db.prepare(`
        INSERT INTO votes (poll_id, user_id, option_id)
        VALUES (?, ?, ?)
      `).run(id, userId, optionId);
    }

    res.send('OK');
  } catch (err) {
    console.error('Ошибка при голосовании:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Удаление голосования
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  const isOwner = db.prepare(`
    SELECT 1 FROM polls p
    JOIN rooms r ON p.room_id = r.id
    WHERE p.id = ? AND r.owner_id = ?
  `).get(id, userId);

  if (!isOwner) {
    return res.status(403).send('Нет прав на удаление');
  }

  db.prepare('DELETE FROM polls WHERE id = ?').run(id);
  res.send('Голосование удалено');
});

// Редактирование голосования (без сброса голосов)
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { question, options } = req.body;
  const userId = req.session.userId;

  // Проверка: владелец?
  const isOwner = db.prepare(`
    SELECT 1 FROM polls p
    JOIN rooms r ON p.room_id = r.id
    WHERE p.id = ? AND r.owner_id = ?
  `).get(id, userId);

  if (!isOwner) {
    return res.status(403).send('Нет прав на редактирование');
  }

  // Обновляем вопрос
  if (question) {
    db.prepare('UPDATE polls SET question = ? WHERE id = ?').run(question, id);
  }

  // Обновляем/добавляем варианты
  const updateOptionStmt = db.prepare('UPDATE poll_options SET text = ? WHERE id = ? AND poll_id = ?');
  const insertOptionStmt = db.prepare('INSERT INTO poll_options (poll_id, text) VALUES (?, ?)');

  (options || []).forEach(option => {
    if (option.id) {
      // Существующий вариант — обновляем
      updateOptionStmt.run(option.text, option.id, id);
    } else {
      // Новый вариант — создаём
      insertOptionStmt.run(id, option.text);
    }
  });

  res.send('Голосование обновлено');
});

module.exports = router;
