// === Онбординг ===
function showOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  const tooltip = document.getElementById('onboarding-tooltip');

  // Показываем оверлей и подсказку
  setTimeout(() => {
    overlay.classList.add('active');
    tooltip.classList.add('active');
  }, 300);
}

function closeOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  const tooltip = document.getElementById('onboarding-tooltip');

  overlay.classList.remove('active');
  tooltip.classList.remove('active');

  // Запоминаем, что пользователь видел
  localStorage.setItem('seenOnboarding', 'true');
}
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  msg.textContent = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Автозапуск при загрузке
document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('seenOnboarding')) {
    setTimeout(showOnboarding, 600);
  }
});
