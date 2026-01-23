// === Загрузка аватара ===
async function loadHeaderAvatar() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const user = await res.json();
      const avatarUrl = user.avatar_url || '/img/default-avatar.png';
      const img = document.getElementById('header-avatar');
      if (img) img.src = avatarUrl;
    }
  } catch (err) {
    console.error('Не удалось загрузить аватарку', err);
  }
}

// === ПЕРЕКЛЮЧЕНИЕ ТЕМЫ ===
function toggleTheme(event) {
  if (event && event.preventDefault) event.preventDefault();

  const body = document.body;
  const icon = document.getElementById('theme-icon');

  if (!icon) {
    console.error("Иконка темы не найдена");
    return;
  }

  if (body.classList.contains('light-theme')) {
    body.classList.remove('light-theme');
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
    localStorage.setItem('theme', 'dark');
  } else {
    body.classList.add('light-theme');
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
    localStorage.setItem('theme', 'light');
  }
}

// === Применение темы и инициализация ===
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  const icon = document.getElementById('theme-icon');

  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    if (icon) {
      icon.classList.add('fa-sun');
      icon.classList.remove('fa-moon');
    }
  } else {
    if (icon) {
      icon.classList.add('fa-moon');
      icon.classList.remove('fa-sun');
    }
  }

  // Загружаем аватар
  loadHeaderAvatar();
});
