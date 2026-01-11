// app.js
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const db = require('./db');
const path = require('path');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const pollRoutes = require('./routes/polls');
const proposalRoutes = require('./routes/proposals');
const notificationRoutes = require('./routes/notifications');


const app = express();
const PORT = process.env.PORT || 3000;

// Парсинг тела
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Статические файлы
app.use(express.static('public'));

// Сессии
const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'sessions.sqlite' }),
  secret: 'ваш_секрет_ключ_смените_на_продакшене',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 дней
});

app.use(sessionMiddleware);

// Middleware: проверка аутентификации
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Маршруты
app.use('/auth', authRoutes);
app.use('/rooms', requireAuth, roomRoutes);
app.use('/polls', requireAuth, pollRoutes);
app.use('/proposals', requireAuth, proposalRoutes);
app.use('/notifications', requireAuth, notificationRoutes);

// Основные страницы — через sendFile, а не render
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/room/:id', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'room.html'));
});

// Запуск сервера
const server = app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// Socket.IO (заглушка)
const io = require('socket.io')(server);
io.use((socket, next) => {
  const req = socket.request;
  const res = {};
  sessionMiddleware(req, res, () => next());
});

module.exports = { app, io };
