// db.js
const Database = require('better-sqlite3');
const path = require('path');

// Создаём подключение
const db = new Database(path.join(__dirname, 'db.sqlite'));
db.pragma('foreign_keys = ON');

// Создаём таблицы
const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS room_members (
    room_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    type TEXT CHECK(type IN ('single', 'multiple', 'rated_options')) NOT NULL DEFAULT 'single',
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    poll_id INTEGER,
    user_id INTEGER,
    option_id INTEGER,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, user_id, option_id),
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
  );

  -- Предложения от участников
  CREATE TABLE IF NOT EXISTS poll_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    proposer_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    type TEXT CHECK(type IN ('single', 'multiple', 'rated_options')) NOT NULL,
    options TEXT NOT NULL,  -- JSON массив строк
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (proposer_id) REFERENCES users(id)
  );

  -- Уведомления
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    actor_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read INTEGER DEFAULT 0,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
  );
`;

db.exec(schema);
console.log('✅ База данных инициализирована');

// === Дополнительные колонки ===
const tableInfo = db.prepare(`PRAGMA table_info(users)`).all();

// 1. Добавляем avatar_url
const hasAvatarColumn = tableInfo.some(col => col.name === 'avatar_url');
if (!hasAvatarColumn) {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '/img/default-avatar.png'`);
  console.log('✅ Колонка avatar_url добавлена в users');
} else {
  console.log('ℹ️ Колонка avatar_url уже существует');
}

// 2. Добавляем password (если был только password_hash)
const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash');
const hasPassword = tableInfo.some(col => col.name === 'password');
if (hasPasswordHash && !hasPassword) {
  db.exec(`ALTER TABLE users ADD COLUMN password TEXT`);
  db.exec(`UPDATE users SET password = password_hash`);
  console.log('✅ Пароли перенесены из password_hash в password');
}

// 3. Добавляем notifications_enabled
const hasNotifColumn = tableInfo.some(col => col.name === 'notifications_enabled');
if (!hasNotifColumn) {
  db.exec(`ALTER TABLE users ADD COLUMN notifications_enabled INTEGER DEFAULT 1`);
  console.log('✅ Колонка notifications_enabled добавлена в users');
} else {
  console.log('ℹ️ Колонка notifications_enabled уже существует');
}

// ✅ ЭКСПОРТ В САМОМ КОНЦЕ!
module.exports = db;
