// public/js/room.js

const pathParts = window.location.pathname.split('/').filter(part => part);
const roomId = parseInt(pathParts[pathParts.length - 1], 10);

console.log('Извлечённый roomId:', roomId);

if (!roomId || isNaN(roomId)) {
  console.error('❌ Не удалось получить roomId');
  alert('Ошибка: не удалось определить комнату');
  throw new Error('roomId is invalid');
}

let currentPoll = null;
let isOwner = false;

// --- Загрузка данных комнаты ---
async function loadRoom() {
  try {
    const response = await fetch(`/rooms/${roomId}`);
    if (!response.ok) throw new Error('Ошибка загрузки комнаты');
    const room = await response.json();

    document.getElementById('room-name').textContent = room.name;
    document.getElementById('room-desc').textContent = room.description || 'Без описания';
    document.getElementById('room-code').textContent = room.invite_code;
    isOwner = room.is_owner;

    const deleteBtn = document.getElementById('delete-room-btn');
    if (isOwner) {
      deleteBtn.classList.remove('opacity-0');
      deleteBtn.onclick = deleteRoom;
    } else {
      deleteBtn.remove();
    }

    document.getElementById('create-poll-button').classList.toggle('hidden', !isOwner);
    document.getElementById('propose-poll-button').classList.toggle('hidden', isOwner);
    document.getElementById('manage-proposals').classList.toggle('hidden', !isOwner);
  } catch (err) {
    console.error('Ошибка:', err);
    document.getElementById('room-name').textContent = 'Ошибка загрузки';
  }
}

// --- Загрузка голосований (без мигания!) ---
async function loadPolls() {
  try {
    const response = await fetch(`/polls/room/${roomId}`);
    if (!response.ok) throw new Error('Ошибка загрузки');
    const polls = await response.json();
    const container = document.getElementById('polls-list');
    container.innerHTML = '';

    if (polls.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-poll text-4xl mb-3 opacity-40"></i>
          <p class="text-lg">Пока нет голосований</p>
          <p class="text-sm">${isOwner ? 'Создайте первое' : 'Предложите идею'}</p>
        </div>`;
      return;
    }

    polls.forEach(poll => {
      const editButtons = isOwner ? `
        <button onclick="editPoll(${poll.id})" class="poll-btn edit">Редактировать</button>
        <button onclick="deletePoll(${poll.id})" class="poll-btn delete">Удалить</button>
      ` : '';

      const card = document.createElement('div');
      card.className = 'poll-card'; // просто добавляем, без .visible
      card.innerHTML = `
        <h3 class="poll-title">${poll.question}</h3>
        <p class="poll-info">Тип: ${
          { single: 'Один вариант', multiple: 'Несколько', rated_options: 'Оценить каждый (1–5)' }[poll.type]
        }</p>
        <p class="poll-info">Голосов: ${poll.vote_count || 0}</p>
        <div class="poll-actions">
          <button onclick="viewPoll(${poll.id})" class="poll-btn" style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;">
            Подробнее
          </button>
          ${editButtons}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Ошибка:', err);
  }
}


// --- Управление предложениями ---
function openProposalsModal() {
  document.getElementById('proposal-modal').classList.remove('hidden');
  loadRoomProposals();
}

function closeProposalModal() {
  document.getElementById('proposal-modal').classList.add('hidden');
}

async function loadRoomProposals() {
  const content = document.getElementById('proposal-content');
  content.innerHTML = '<p class="text-gray-500">Загрузка предложений...</p>';

  try {
    const res = await fetch(`/proposals/room/${roomId}`);
    if (!res.ok) throw new Error('Не удалось загрузить');

    const proposals = await res.json();
    if (proposals.length === 0) {
      content.innerHTML = '<p class="text-gray-500">Нет нерассмотренных предложений</p>';
      return;
    }

    content.innerHTML = '';
    proposals.forEach(p => {
      const item = document.createElement('div');
      item.className = 'mb-4 p-3 border rounded-lg bg-gray-50';
      item.innerHTML = `
        <h3 class="font-semibold">${p.question}</h3>
        <p class="text-sm text-gray-600">от @${p.username}</p>
        <p class="text-sm text-gray-500">Тип: ${p.type === 'single' ? 'Один' : p.type === 'multiple' ? 'Несколько' : 'Оценить каждый'}</p>
        <div class="mt-2 text-sm">
          <strong>Варианты:</strong>
          <ul class="list-disc list-inside mt-1">
            ${JSON.parse(p.options).map(opt => `<li>${opt}</li>`).join('')}
          </ul>
        </div>
        <div class="mt-3 flex gap-2">
          <button onclick="approveProposal(${p.id})" class="btn-modal save text-xs px-3 py-1">✅ Одобрить</button>
          <button onclick="rejectProposal(${p.id}, this)" class="btn-modal cancel text-xs px-3 py-1">❌ Отклонить</button>
        </div>
      `;
      content.appendChild(item);
    });
  } catch (err) {
    content.innerHTML = '<p class="text-red-500">Ошибка загрузки</p>';
    console.error(err);
  }
}

async function approveProposal(id) {
  if (!confirm('Одобрить это предложение?')) return;

  try {
    const res = await fetch(`/proposals/approve/${id}`, { method: 'POST' });
    if (res.ok) {
      alert('Голосование создано!');
      closeProposalModal();
      loadPolls();
      fetchGlobalNotifications?.();
    } else {
      alert('Ошибка при одобрении');
    }
  } catch (err) {
    alert('Не удалось одобрить');
  }
}

async function rejectProposal(id, btn) {
  if (!confirm('Отклонить предложение?')) return;

  try {
    await fetch(`/proposals/reject/${id}`, { method: 'POST' });
    btn.closest('.mb-4').remove();
  } catch (err) {
    alert('Ошибка');
  }
}

// --- Создание голосования ---
function openCreatePollModal() {
  document.getElementById('create-poll-modal').classList.remove('hidden');
  document.getElementById('poll-type').value = 'single';
}

function closeCreatePollModal() {
  document.getElementById('create-poll-modal').classList.add('hidden');
  const form = document.getElementById('create-poll-modal-form');
  form.reset();
  const inputs = document.getElementById('options-inputs');
  while (inputs.children.length > 2) {
    inputs.removeChild(inputs.children[0]);
  }
}

function addOption() {
  const inputs = document.getElementById('options-inputs');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-input mt-2';
  input.placeholder = 'Новый вариант';
  input.required = true;
  inputs.appendChild(input);
}

document.getElementById('create-poll-modal-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('poll-question').value.trim();
  const type = document.getElementById('poll-type').value;
  const options = Array.from(document.querySelectorAll('#options-inputs .form-input'))
    .map(el => el.value.trim())
    .filter(text => text);

  if (!question) return alert('Введите вопрос');
  if (options.length < 2) return alert('Минимум 2 варианта');

  try {
    const res = await fetch('/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, question, type, options })
    });

    if (res.ok) {
      closeCreatePollModal();
      loadPolls();
    } else {
      const error = await res.text();
      alert('Ошибка: ' + error);
    }
  } catch (err) {
    alert('Не удалось создать');
  }
});

// --- Просмотр голосования ---
async function viewPoll(pollId) {
  try {
    const res = await fetch(`/polls/${pollId}`);
    if (!res.ok) throw new Error('Не найдено');
    currentPoll = await res.json();
    const modal = document.getElementById('poll-modal');
    const content = document.getElementById('poll-content');
    modal.classList.remove('hidden');

    let html = `<h3 class="text-lg font-semibold mb-4">${currentPoll.question}</h3>`;

    if (currentPoll.user_vote) {
      html += `<p class="text-green-600">Вы уже проголосовали!</p>`;
    } else if (currentPoll.type === 'rated_options') {
      html += `<p class="text-gray-700 mb-3">Оцените каждый вариант:</p>`;
      currentPoll.options.forEach(opt => {
        html += `
          <div class="mb-3">
            <label class="block font-medium text-white">${opt.text}</label>
            <select name="rating_${opt.id}" class="form-select mt-1 w-full">
              <option value="">—</option>
              <option value="1">1 — Ужасно</option>
              <option value="2">2 — Плохо</option>
              <option value="3">3 — Нормально</option>
              <option value="4">4 — Хорошо</option>
              <option value="5">5 — Отлично</option>
            </select>
          </div>`;
      });
      html += `<button onclick="submitRatedOptions()" class="btn-modal save mt-4 w-full">Оценить</button>`;
    } else {
      html += `<div class="space-y-2 mb-4">`;
      currentPoll.options.forEach(opt => {
        const inputType = currentPoll.type === 'multiple' ? 'checkbox' : 'radio';
        html += `
          <label class="custom-option">
            <input type="${inputType}" name="vote-option" value="${opt.id}" class="peer">
            <div class="custom-control">
              ${inputType === 'radio'
                ? '<div class="custom-control-inner"></div>'
                : '<svg class="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>'
              }
            </div>
            <span class="text-gray-200 group-hover:text-white transition">${opt.text}</span>
          </label>`;
      });
      html += `</div>`;
      html += `<button onclick="submitVote()" class="btn-modal save w-full">Проголосовать</button>`;
    }

    // Результаты
    html += `<hr class="my-4 border-gray-700">`;
    html += `<h4 class="font-medium">Результаты:</h4>`;
    if (currentPoll.type === 'rated_options') {
      currentPoll.options.forEach(opt => {
        const avg = opt.average_rating ? Number(opt.average_rating).toFixed(1) : '—';
        html += `<div>${opt.text}: <strong>${avg}</strong> (${opt.vote_count} голосов)</div>`;
      });
    } else {
      currentPoll.options.forEach(opt => {
        html += `<div>${opt.text}: <strong>${opt.votes || 0}</strong> голосов</div>`;
      });
    }

    content.innerHTML = html;
  } catch (err) {
    alert('Ошибка загрузки');
  }
}

async function submitVote() {
  const selected = Array.from(document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked'))
    .map(el => el.value);

  if (selected.length === 0) return alert('Выберите вариант');

  try {
    const res = await fetch(`/polls/${currentPoll.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: selected[0] })
    });

    if (res.ok) {
      alert('Спасибо за голос!');
      closePollModal();
      loadPolls();
    } else {
      alert('Ошибка при голосовании');
    }
  } catch (err) {
    alert('Не удалось проголосовать');
  }
}

async function submitRatedOptions() {
  const ratings = {};
  let valid = true;
  currentPoll.options.forEach(opt => {
    const value = document.querySelector(`[name="rating_${opt.id}"]`)?.value;
    if (!value) valid = false;
    ratings[opt.id] = Number(value);
  });
  if (!valid) return alert('Оцените все варианты');

  try {
    const res = await fetch(`/polls/${currentPoll.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratings })
    });
    if (res.ok) {
      alert('Спасибо!');
      closePollModal();
      loadPolls();
    } else {
      alert('Ошибка');
    }
  } catch (err) {
    alert('Не удалось оценить');
  }
}

function closePollModal() {
  document.getElementById('poll-modal').classList.add('hidden');
}

// --- Редактирование ---
async function editPoll(pollId) {
  try {
    const res = await fetch(`/polls/${pollId}`);
    if (!res.ok) throw new Error('Не найдено');
    currentPoll = await res.json();
    if (!currentPoll.is_owner) return alert('Только владелец может редактировать');

    document.getElementById('edit-poll-id').value = currentPoll.id;
    document.getElementById('edit-poll-question').value = currentPoll.question;

    const container = document.getElementById('edit-options-inputs');
    container.innerHTML = '';
    currentPoll.options.forEach(opt => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input mt-2';
      input.value = opt.text;
      input.dataset.id = opt.id;
      input.required = true;
      container.appendChild(input);
    });

    document.getElementById('edit-poll-modal').classList.remove('hidden');
  } catch (err) {
    alert('Не удалось загрузить');
  }
}

function closeEditPollModal() {
  document.getElementById('edit-poll-modal').classList.add('hidden');
}

function addEditOption() {
  const container = document.getElementById('edit-options-inputs');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-input mt-2';
  input.placeholder = 'Новый вариант';
  input.required = true;
  container.appendChild(input);
}

document.getElementById('edit-poll-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pollId = document.getElementById('edit-poll-id').value;
  const question = document.getElementById('edit-poll-question').value;
  const options = Array.from(document.querySelectorAll('#edit-options-inputs .form-input'))
    .map(el => ({ id: el.dataset.id || null, text: el.value.trim() }))
    .filter(opt => opt.text);

  if (options.length < 2) return alert('Минимум 2 варианта');

  try {
    const res = await fetch(`/polls/${pollId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options })
    });
    if (res.ok) {
      alert('Сохранено!');
      closeEditPollModal();
      loadPolls();
    } else {
      alert('Ошибка: ' + await res.text());
    }
  } catch (err) {
    alert('Не удалось сохранить');
  }
});

// --- Предложить голосование ---
function openProposeModal() {
  document.getElementById('propose-room-id').value = roomId;
  document.getElementById('propose-modal').classList.remove('hidden');
}

function closeProposeModal() {
  document.getElementById('propose-modal').classList.add('hidden');
}

function addProposeOption() {
  const container = document.getElementById('propose-options');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-input mt-2';
  input.placeholder = 'Новый вариант';
  input.required = true;
  container.appendChild(input);
}

document.getElementById('propose-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('propose-question').value.trim();
  const type = document.getElementById('propose-type').value;
  const options = Array.from(document.querySelectorAll('#propose-options .form-input'))
    .map(el => el.value.trim())
    .filter(v => v);

  if (!question) return alert('Введите вопрос');
  if (options.length < 2) return alert('Минимум 2 варианта');

  try {
    const res = await fetch('/proposals/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, question, type, options })
    });
    if (res.ok) {
      closeProposeModal();
      alert('Предложение отправлено!');
    } else {
      alert('Ошибка при отправке');
    }
  } catch (err) {
    alert('Не удалось отправить');
  }
});

// --- Удаление голосования и комнаты ---
async function deletePoll(pollId) {
  if (!confirm('Удалить голосование?')) return;
  try {
    const res = await fetch(`/polls/${pollId}`, { method: 'DELETE' });
    if (res.ok) loadPolls();
    else alert('Не удалось удалить');
  } catch (err) {
    alert('Ошибка сети');
  }
}

async function deleteRoom() {
  if (!isOwner) return alert('Только владелец может удалить');
  if (!confirm('Удалить комнату? Это нельзя отменить.')) return;

  try {
    const res = await fetch(`/rooms/${roomId}`, { method: 'DELETE' });
    if (res.ok) {
      alert('Комната удалена');
      window.location.href = '/dashboard';
    } else {
      alert('Не удалось удалить');
    }
  } catch (err) {
    alert('Ошибка сети');
  }
}

// === Копирование ссылки ===
async function copyInviteLink(event) {
  event.preventDefault();
  const code = document.getElementById('room-code')?.textContent?.trim();
  if (!code) return showToast('Код не найден', 'error');

  const url = `${window.location.origin}/room/join/${code}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Ссылка скопирована!', 'success');
  } catch (err) {
    showToast('Не удалось скопировать', 'error');
  }
}

function showToast(message, type = 'success') {
  let feedback = document.getElementById('copy-feedback-tooltip');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'copy-feedback-tooltip';
    feedback.className = 'copy-feedback';
    feedback.innerHTML = `<i class="fas fa-copy mr-2"></i> <span id="feedback-text"></span>`;
    document.body.appendChild(feedback);
  }

  const textEl = feedback.querySelector('#feedback-text');
  textEl.textContent = message;

  const icon = feedback.querySelector('i');
  icon.className = type === 'success' ? 'fas fa-check mr-2' : 'fas fa-times mr-2';
  icon.style.color = type === 'success' ? '#6ee7b7' : '#fca5a5';

  feedback.classList.add('show');
  setTimeout(() => feedback.classList.remove('show'), 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('room-name')) {
    loadRoom().then(loadPolls); // Ждём loadRoom → потом loadPolls
  }
});

