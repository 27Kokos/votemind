// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Валидация
  if (!username || !email || !password) {
    return res.status(400).send('Все поля обязательны');
  }

  const hash = await bcrypt.hash(password, 10);
  console.log('Хэш пароля:', hash);

  try {
    db.prepare(`
      INSERT INTO users (username, email, password_hash)
      VALUES (?, ?, ?)
    `).run(username, email, hash);

    console.log('✅ Пользователь зарегистрирован:', username);

    // Лог: проверим, что в БД
    const all = db.prepare('SELECT id, username, email FROM users').all();
    console.log('🔍 Все пользователи:', all);

    res.redirect('/login');

  } catch (err) {
    console.error('❌ Ошибка при регистрации:', err.message);

    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).send('Пользователь с таким email или никнеймом уже существует');
    }

    res.status(500).send('Ошибка сервера');
  }
});




// Вход
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Попытка входа:', { username, password });

  // 🔽 Разделяем на 2 шага
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username); // Выполняем запрос

  console.log('Raw result:', user); // ← Посмотрим, что пришло

  if (!user) {
    return res.status(401).send('Пользователь не найден');
  }

  // Проверим, есть ли password_hash
  console.log('User from DB:', JSON.stringify(user, null, 2));

  if (!user.password_hash) {
    console.error('❌ В БД нет password_hash!');
    return res.status(500).send('Ошибка сервера: нет хэша пароля');
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  console.log('Пароль совпадает:', isMatch);

  if (isMatch) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/dashboard');
  } else {
    res.status(401).send('Неверный пароль');
  }
});





// Выход
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
