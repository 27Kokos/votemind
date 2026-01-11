// public/js/header.js
async function loadHeaderAvatar() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const user = await res.json();
      const avatarUrl = user.avatar_url || '/img/default-avatar.png';
      const img = document.getElementById('header-avatar');
      if (img) {
        img.src = avatarUrl;
      }
    }
  } catch (err) {
    console.error('Не удалось загрузить аватарку', err);
  }
}

document.addEventListener('DOMContentLoaded', loadHeaderAvatar);
