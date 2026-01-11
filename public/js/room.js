// public/js/room.js

const pathParts = window.location.pathname.split('/').filter(part => part);
const roomId = pathParts[pathParts.length - 1];

console.log('Извлечённый roomId:', roomId);

if (!roomId || isNaN(roomId)) {
  console.error('❌ Не удалось получить roomId');
  alert('Ошибка: не удалось определить комнату');
  throw new Error('roomId is invalid');
}

let currentPoll = null;
let isOwner = false;
let currentProposal = null;

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

    document.getElementById('create-poll-button').classList.toggle('hidden', !isOwner);
    document.getElementById('propose-poll-button').classList.toggle('hidden', isOwner);
    document.getElementById('manage-proposals').classList.toggle('hidden', !isOwner);
  } catch (err) {
    console.error('Ошибка:', err);
    document.getElementById('room-name').textContent = 'Ошибка загрузки';
  }
}

// --- Загрузка голосований ---
async function loadPolls() {
  try {
    const response = await fetch(`/polls/room/${roomId}`);
    if (!response.ok) throw new Error('Ошибка загрузки');
    const polls = await response.json();
    const container = document.getElementById('polls-list');
    container.innerHTML = '';

    if (polls.length === 0) {
      container.innerHTML = '<p class="text-gray-500">Пока нет голосований.</p>';
      return;
    }

    polls.forEach(poll => {
      const editButtons = isOwner ? `
        <div class="mt-2 space-x-2">
          <button onclick="editPoll(${poll.id})" class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200">Ред.</button>
          <button onclick="deletePoll(${poll.id})" class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200">Удалить</button>
        </div>
      ` : '';

      const card = `
        <div class="border rounded-lg p-4 mb-4 bg-gray-50">
          <h3 class="font-semibold">${poll.question}</h3>
          <p class="text-sm text-gray-500">Тип: ${
            { single: 'Один вариант', multiple: 'Несколько', rated_options: 'Оценить каждый (1–5)' }[poll.type]
          }</p>
          <p class="text-sm text-gray-500">Голосов: ${poll.vote_count || 0}</p>
          <button onclick="viewPoll(${poll.id})" class="text-sm text-blue-600 hover:underline mt-2">Подробнее</button>
          ${editButtons}
        </div>
      `;
      container.insertAdjacentHTML('beforeend', card);
    });
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

// --- Открытие модалки с предложениями ---
function openProposalsModal() {
  document.getElementById('proposal-modal').classList.remove('hidden');
  loadRoomProposals();
}

function closeProposalModal() {
  document.getElementById('proposal-modal').classList.add('hidden');
}

// --- Загрузка предложений для этой комнаты ---
async function loadRoomProposals() {
  const content = document.getElementById('proposal-content');
  content.innerHTML = '<p>Загрузка предложений...</p>';

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
        <div class="mt-3 space-x-2">
          <button onclick="approveProposal(${p.id})" class="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">✅ Одобрить</button>
          <button onclick="rejectProposal(${p.id}, this)" class="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">❌ Отклонить</button>
        </div>
      `;
      content.appendChild(item);
    });
  } catch (err) {
    content.innerHTML = '<p class="text-red-500">Ошибка загрузки предложений</p>';
    console.error(err);
  }
}

// --- Одобрить предложение ---
async function approveProposal(id) {
  if (!confirm('Одобрить это предложение?')) return;

  try {
    const res = await fetch(`/proposals/approve/${id}`, { method: 'POST' });
    if (res.ok) {
      alert('Предложение одобрено! Голосование создано.');
      closeProposalModal();
      loadPolls();
      fetchGlobalNotifications();
    } else {
      alert('Ошибка при одобрении');
    }
  } catch (err) {
    alert('Не удалось одобрить');
  }
}

// --- Отклонить предложение ---
async function rejectProposal(id, btn) {
  if (!confirm('Отклонить это предложение?')) return;

  try {
    await fetch(`/proposals/reject/${id}`, { method: 'POST' });
    btn.closest('.mb-4').remove();
  } catch (err) {
    alert('Ошибка при отклонении');
  }
}

// --- Модальные окна (создание, редактирование и т.д.) ---
function openCreatePollModal() {
  document.getElementById('create-poll-modal').classList.remove('hidden');
  document.getElementById('poll-type').value = 'single';
  updateOptionsVisibility();
}

function closeCreatePollModal() {
  document.getElementById('create-poll-modal').classList.add('hidden');
  const form = document.getElementById('create-poll-modal-form');
  form.reset();
  const inputs = document.getElementById('options-inputs');
  while (inputs.children.length > 2) {
    inputs.removeChild(inputs.children[0]);
  }
  updateOptionsVisibility();
}

function updateOptionsVisibility() {
  const type = document.getElementById('poll-type').value;
  const container = document.getElementById('options-container');
  container.style.display = 'block';
}

function addOption() {
  const inputs = document.getElementById('options-inputs');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'option-input w-full px-3 py-2 border rounded-lg mb-2';
  input.placeholder = 'Новый вариант';
  input.required = true;
  inputs.appendChild(input);
}

// --- Отправка нового голосования ---
document.getElementById('create-poll-modal-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('poll-question').value;
  const type = document.getElementById('poll-type').value;
  const options = Array.from(document.querySelectorAll('#options-inputs .option-input'))
    .map(el => el.value.trim())
    .filter(text => text);

  if ((type === 'single' || type === 'multiple') && options.length < 2) {
    alert('Минимум 2 варианта');
    return;
  }

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
    alert('Не удалось отправить');
  }
});

// --- Просмотр голосования ---
async function viewPoll(pollId) {
  try {
    const res = await fetch(`/polls/${pollId}`);
    if (!res.ok) throw new Error('Голосование не найдено');
    currentPoll = await res.json();
    const modal = document.getElementById('poll-modal');
    const content = document.getElementById('poll-content');
    modal.classList.remove('hidden');

    let html = `<h3 class="text-lg font-semibold mb-4">${currentPoll.question}</h3>`;

    if (currentPoll.user_vote) {
      html += `<p class="text-green-600">Вы уже проголосовали!</p>`;
    } else if (currentPoll.type === 'rated_options') {
      html += `<p class="text-gray-700 mb-3">Оцените каждый вариант от 1 до 5:</p>`;
      currentPoll.options.forEach(opt => {
        html += `
          <div class="mb-3">
            <label class="block font-medium">${opt.text}</label>
            <select name="rating_${opt.id}" class="mt-1 border rounded px-2 py-1 w-full">
              <option value="">Не оценено</option>
              <option value="1">1 — Ужасно</option>
              <option value="2">2 — Плохо</option>
              <option value="3">3 — Нормально</option>
              <option value="4">4 — Хорошо</option>
              <option value="5">5 — Отлично</option>
            </select>
          </div>`;
      });
      html += `<button onclick="submitRatedOptions()" class="bg-blue-600 text-white py-2 px-4 rounded mt-4">Оценить всё</button>`;
    } else {
      currentPoll.options.forEach(opt => {
        const inputType = currentPoll.type === 'multiple' ? 'checkbox' : 'radio';
        html += `
          <label class="flex items-center mb-2">
            <input type="${inputType}" name="option" value="${opt.id}" class="mr-2">
            ${opt.text}
          </label>`;
      });
      html += `<button onclick="submitVote()" class="bg-blue-600 text-white py-2 px-4 rounded mt-4">Проголосовать</button>`;
    }

    // Результаты
    html += `<hr class="my-4">`;
    if (currentPoll.type === 'rated_options') {
      html += `<h4 class="font-medium mt-4">Средние оценки:</h4>`;
      currentPoll.options.forEach(opt => {
        const avg = opt.average_rating ? Number(opt.average_rating).toFixed(1) : '—';
        html += `<div>${opt.text}: <strong>${avg}</strong> (${opt.vote_count} голосов)</div>`;
      });
    } else {
      html += `<h4 class="font-medium mt-4">Результаты:</h4>`;
      currentPoll.options.forEach(opt => {
        html += `<div>${opt.text}: <strong>${opt.votes || 0}</strong> голосов</div>`;
      });
    }

    content.innerHTML = html;
  } catch (err) {
    alert('Не удалось загрузить голосование');
  }
}

async function submitVote() {
  const selected = Array.from(document.querySelectorAll('input[name="option"]:checked')).map(el => el.value);
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
      alert('Спасибо за оценки!');
      closePollModal();
      loadPolls();
    } else {
      alert('Ошибка при оценке');
    }
  } catch (err) {
    alert('Не удалось оценить');
  }
}

function closePollModal() {
  document.getElementById('poll-modal').classList.add('hidden');
}

async function deletePoll(pollId) {
  if (!confirm('Удалить это голосование?')) return;
  try {
    const res = await fetch(`/polls/${pollId}`, { method: 'DELETE' });
    if (res.ok) loadPolls();
    else alert('Не удалось удалить');
  } catch (err) {
    alert('Ошибка сети');
  }
}

async function editPoll(pollId) {
  try {
    const res = await fetch(`/polls/${pollId}`);
    if (!res.ok) throw new Error('Не найдено');
    currentPoll = await res.json();
    if (!currentPoll.is_owner) return alert('Только владелец может редактировать');

    document.getElementById('edit-poll-id').value = currentPoll.id;
    document.getElementById('edit-poll-question').value = currentPoll.question;
    document.getElementById('edit-poll-type').value = currentPoll.type;

    const container = document.getElementById('edit-options-inputs');
    container.innerHTML = '';
    currentPoll.options.forEach(opt => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'option-input w-full px-3 py-2 border rounded-lg mb-2';
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
  input.className = 'option-input w-full px-3 py-2 border rounded-lg mb-2';
  input.placeholder = 'Новый вариант';
  input.required = true;
  container.appendChild(input);
}

document.getElementById('edit-poll-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pollId = document.getElementById('edit-poll-id').value;
  const question = document.getElementById('edit-poll-question').value;
  const options = Array.from(document.querySelectorAll('#edit-options-inputs .option-input'))
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
  input.className = 'w-full px-3 py-2 border rounded-lg mb-2';
  input.placeholder = 'Новый вариант';
  input.required = true;
  container.appendChild(input);
}

document.getElementById('propose-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const roomIdInput = document.getElementById('propose-room-id').value;
  const question = document.getElementById('propose-question').value;
  const type = document.getElementById('propose-type').value;
  const options = Array.from(document.querySelectorAll('#propose-options input'))
    .map(el => el.value.trim())
    .filter(v => v);

  if (options.length < 2) return alert('Минимум 2 варианта');

  try {
    const res = await fetch('/proposals/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: roomIdInput, question, type, options })
    });
    if (res.ok) {
      closeProposeModal();
      alert('Предложение отправлено владельцу');
    } else {
      alert('Ошибка при отправке');
    }
  } catch (err) {
    console.error('Ошибка при отправке предложения:', err);
    alert('Не удалось отправить');
  }
});

// --- Загрузка при старте ---
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('room-name')) {
    loadRoom();
    loadPolls();
    setInterval(loadPolls, 3000);
  }
});
