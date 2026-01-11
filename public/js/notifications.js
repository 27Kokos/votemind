// public/js/notifications.js

let notifications = [];
let unreadCount = 0;

// Получаем элементы, если они есть
const badge = document.getElementById('notification-badge');
const menu = document.getElementById('notifications-menu');
const list = document.getElementById('notifications-list');

// Если элементов нет (например, на другой странице) — не ломаемся
function updateBadge() {
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

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

async function openNotification(n) {
  if (menu) menu.classList.add('hidden');
  if (n.type === 'approved') {
    window.location.href = `/room/${n.room_id}`;
  } else {
    await markAsRead(n.id);
  }
}

async function markAsRead(id) {
  await fetch(`/notifications/${id}/read`, { method: 'POST' });
  const notif = notifications.find(n => n.id === id);
  if (notif) notif.read = 1;
  unreadCount = notifications.filter(n => !n.read).length;
  updateBadge();
  updateNotificationsUI();
}

async function markAllAsRead() {
  if (!menu || menu.classList.contains('hidden')) return;
  await fetch(`/notifications/read-all`, { method: 'POST' });
  notifications.forEach(n => n.read = 1);
  unreadCount = 0;
  updateBadge();
  updateNotificationsUI();
}

function toggleNotifications(e) {
  if (!menu || !e) return;
  e.preventDefault();
  menu.classList.toggle('hidden');
  if (!menu.classList.contains('hidden')) {
    markAllAsRead();
  }
}

async function fetchGlobalNotifications() {
  try {
    const res = await fetch('/notifications');
    if (!res.ok) throw new Error('Ошибка');
    const data = await res.json();
    notifications = data;
    unreadCount = data.filter(n => !n.read).length;
    updateBadge();
    updateNotificationsUI();
  } catch (err) {
    console.error('Ошибка уведомлений:', err);
  }
}

// Автообновление — каждые 10 сек
setInterval(fetchGlobalNotifications, 10000);

// Загружаем при старте
document.addEventListener('DOMContentLoaded', fetchGlobalNotifications);
