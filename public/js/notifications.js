// public/js/notifications.js

let notifications = [];
let unreadCount = 0;
let notificationsEnabled = true; // по умолчанию включены

// Получаем элементы
const badge = document.getElementById('notification-badge');
const menu = document.getElementById('notifications-menu');
const list = document.getElementById('notifications-list');

// === Проверка, включены ли уведомления ===
async function checkNotificationsEnabled() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      notificationsEnabled = data.notifications_enabled === true;
    } else {
      console.warn('Не удалось загрузить настройки уведомлений');
    }
  } catch (err) {
    console.error('Ошибка при проверке настроек уведомлений:', err);
  }

  // Применяем состояние
  if (!notificationsEnabled) {
    if (badge) badge.classList.add('hidden');
    if (menu) menu.classList.add('hidden');
    return false;
  }
  return true;
}

// === Обновление бейджа ===
function updateBadge() {
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// === Обновление UI списка ===
function updateNotificationsUI() {
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = '<div class="p-3 text-gray-500 text-sm">Нет уведомлений</div>';
    return;
  }

  list.innerHTML = '';
  notifications.forEach(n => {
    const item = document.createElement('div');
    item.className = `notification-item ${n.read ? '' : 'unread'}`;
    item.innerHTML = `
      <div class="text-sm">
        <strong>${n.title}</strong>
        <div class="text-gray-600 text-xs mt-1">${n.room_name} · ${new Date(n.created_at).toLocaleString('ru')}</div>
      </div>
    `;
    item.onclick = () => openNotification(n);
    list.appendChild(item);
  });
}

// === Открытие уведомления ===
async function openNotification(n) {
  if (menu) menu.classList.add('hidden');
  if (n.type === 'approved') {
    window.location.href = `/room/${n.room_id}`;
  } else {
    await markAsRead(n.id);
  }
}

// === Отметить как прочитанное ===
async function markAsRead(id) {
  await fetch(`/notifications/${id}/read`, { method: 'POST' });
  const notif = notifications.find(n => n.id === id);
  if (notif) notif.read = 1;
  unreadCount = notifications.filter(n => !n.read).length;
  updateBadge();
  updateNotificationsUI();
}

// === Отметить все как прочитанные ===
async function markAllAsRead() {
  if (!menu || menu.classList.contains('hidden')) return;
  await fetch(`/notifications/read-all`, { method: 'POST' });
  notifications.forEach(n => n.read = 1);
  unreadCount = 0;
  updateBadge();
  updateNotificationsUI();
}

// === Переключение меню ===
function toggleNotifications(e) {
  if (!menu || !e) return;
  e.preventDefault();
  if (!notificationsEnabled) return; // ❌ Нельзя открыть, если выключено
  menu.classList.toggle('hidden');
  if (!menu.classList.contains('hidden')) {
    markAllAsRead();
  }
}

// === Загрузка уведомлений ===
async function fetchGlobalNotifications() {
  if (!notificationsEnabled) return; // ❌ Не грузим, если выключено

  try {
    const res = await fetch('/notifications');
    if (!res.ok) throw new Error('Ошибка загрузки');
    const data = await res.json();
    notifications = data;
    unreadCount = data.filter(n => !n.read).length;
    updateBadge();
    updateNotificationsUI();
  } catch (err) {
    console.error('Ошибка уведомлений:', err);
  }
}

// === Инициализация ===
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Сначала проверяем, включены ли уведомления
    const isEnabled = await checkNotificationsEnabled();

    if (isEnabled) {
      // Только если включены — начинаем автообновление
      fetchGlobalNotifications();
      setInterval(fetchGlobalNotifications, 10000);
    }
  } catch (err) {
    console.error('Ошибка инициализации:', err);
  }
  window.toggleNotifications = toggleNotifications;

});
