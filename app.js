/* Борт КолФан · interactive, browser-only demonstration. No requests or remote services. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ICON_ARROW = '<svg class="icon"><use href="#i-arrow"/></svg>';
  const PERIOD = 90 * 60 * 1000;
  const startedAt = Date.now();
  const demoDeadlineBefore = startedAt + 3 * 60 * 60 * 1000;
  const nextDeadline = startedAt + 32 * 60 * 60 * 1000;
  const storageKey = 'kolfan-kubrik-static-demo-v5';
  const adminPresenceKey = 'kolfan-kubrik-admin-presence-v1';
  const MIN_TEAMS = 4;
  const MAX_TEAMS = 12;
  const ADMIN_HEARTBEAT_MS = 15000;
  const formatTimeMsk = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
  const formatClockMsk = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDateMsk = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const formatLocalDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const cloneData = (value) => JSON.parse(JSON.stringify(value));
  const randomId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizeRecoveryCode = (value) => String(value || '').toUpperCase().replace(/[\s-]/g, '');
  const makeRecoveryCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    return `KOLFAN-${part()}-${part()}`;
  };
  let adminSessionId = '';
  let sessionRole = 'matros';
  let sessionDisplayName = '';
  let adminDisplayName = '';
  let sessionCandidateId = '';
  try {
    adminSessionId = sessionStorage.getItem('kolfan-admin-session-id') || randomId('admin');
    sessionStorage.setItem('kolfan-admin-session-id', adminSessionId);
    sessionRole = sessionStorage.getItem('kolfan-role') || 'matros';
    sessionDisplayName = sessionStorage.getItem('kolfan-display-name') || '';
    adminDisplayName = sessionStorage.getItem('kolfan-admin-display-name') || '';
    sessionCandidateId = sessionStorage.getItem('kolfan-candidate-id') || '';
  } catch (_) {
    adminSessionId = randomId('admin');
  }
  if (!['matros', 'captain', 'admiral'].includes(sessionRole)) sessionRole = 'matros';

  function makeTour(number, base = startedAt) {
    const start = base + (number - 1) * 7 * 24 * 60 * 60 * 1000;
    return { id: `tour-${number}`, number, startAt: start, deadlineAt: start + 3 * 60 * 60 * 1000, status: 'planned', openedAt: null, completedAt: null };
  }
  function defaultTournament() {
    return { status: 'preparation', tourCount: 4, tours: [1, 2, 3, 4].map((number) => makeTour(number)), activeTourId: null, adminOwnerSessionId: null, adminRecoveryCode: null, startedAt: null, finishedAt: null };
  }

  const originalTeams = [
    { id: 'mayak', name: 'Маяк', mark: '✷', theme: 'ochre', description: 'Светим, когда за бортом темно.', demoName: 'Лея', members: [
      { name: 'Мира', role: 'captain', token: 'DEMO-MAYAK-MIRA' },
      { name: 'Лея', role: 'member', token: 'DEMO-MAYAK-LEYA' },
      { name: 'Рома', role: 'member', token: 'DEMO-MAYAK-ROMA' },
      { name: 'Ася', role: 'member', token: 'DEMO-MAYAK-ASYA' }
    ] },
    { id: 'archipelago', name: 'Архипелаг', mark: '◈', theme: 'teal', description: 'У каждого свой остров, курс один.', demoName: 'Тимур', members: [
      { name: 'Соня', role: 'captain', token: 'DEMO-ARCH-SONYA' },
      { name: 'Тимур', role: 'member', token: 'DEMO-ARCH-TIMUR' },
      { name: 'Марта', role: 'member', token: 'DEMO-ARCH-MARTA' },
      { name: 'Ян', role: 'member', token: 'DEMO-ARCH-YAN' }
    ] },
    { id: 'harbor', name: 'Тихая гавань', mark: '❋', theme: 'blue', description: 'Тихо только до первого гудка.', demoName: 'Ника', members: [
      { name: 'Варя', role: 'captain', token: 'DEMO-HARBOR-VARYA' },
      { name: 'Ника', role: 'member', token: 'DEMO-HARBOR-NIKA' },
      { name: 'Лис', role: 'member', token: 'DEMO-HARBOR-LIS' },
      { name: 'Павел', role: 'member', token: 'DEMO-HARBOR-PAVEL' }
    ] },
    { id: 'wind', name: 'Северный ветер', mark: '✧', theme: 'rose', description: 'Идём по звёздам, не по прогнозу.', demoName: 'Глеб', members: [
      { name: 'Агата', role: 'captain', token: 'DEMO-WIND-AGATA' },
      { name: 'Глеб', role: 'member', token: 'DEMO-WIND-GLEB' },
      { name: 'Сима', role: 'member', token: 'DEMO-WIND-SIMA' },
      { name: 'Олег', role: 'member', token: 'DEMO-WIND-OLEG' }
    ] }
  ];

  const demoMessages = [
    { id: 'g1', channel: 'global', author: 'Адмирал', teamId: null, text: 'Кают-компания открыта. Всем спасибо за тур! Делитесь впечатлениями от рассказов.', at: startedAt - 48 * 60 * 1000 },
    { id: 'g2', channel: 'global', author: 'Марта', teamId: 'archipelago', text: 'Перечитываю всё с самого начала. После дедлайна это ощущается совсем иначе ☕', at: startedAt - 26 * 60 * 1000 },
    { id: 'g3', channel: 'global', author: 'Ника', teamId: 'harbor', text: 'С кем можно обсудить опубликованные финалы? Обещаю предупреждать о спойлерах.', at: startedAt - 8 * 60 * 1000 },
    { id: 't1', channel: 'mayak', author: 'Мира', teamId: 'mayak', text: '@Лея, загляни в вахтенный график, пожалуйста. Если не успеваешь — просто маякни здесь.', at: startedAt - 62 * 60 * 1000 },
    { id: 't2', channel: 'mayak', author: 'Лея', teamId: 'mayak', text: 'Я на борту! Чай поставила, часы сверила. ☕', at: startedAt - 43 * 60 * 1000 },
    { id: 't3', channel: 'mayak', author: 'Ася', teamId: 'mayak', text: 'После дедлайна чат каюты не запираем, да? У меня накопились впечатления от опубликованного.', at: startedAt - 13 * 60 * 1000 },
    { id: 't4', channel: 'archipelago', author: 'Соня', teamId: 'archipelago', text: 'Ребята, вахты по графику. А наш чат каюты живёт и после дедлайна.', at: startedAt - 72 * 60 * 1000 },
    { id: 't5', channel: 'archipelago', author: 'Тимур', teamId: 'archipelago', text: 'Проверил часы, у меня всё совпадает с временем МСК.', at: startedAt - 39 * 60 * 1000 },
    { id: 't6', channel: 'harbor', author: 'Варя', teamId: 'harbor', text: 'Спасибо экипажу за этот тур! Встречаемся здесь, когда все истории будут опубликованы.', at: startedAt - 53 * 60 * 1000 },
    { id: 't7', channel: 'wind', author: 'Агата', teamId: 'wind', text: 'До следующей вахты остаёмся на связи. Главное — не терять друг друга.', at: startedAt - 32 * 60 * 1000 }
  ];

  const demoQuestions = [
    { id: 'q-demo-1', author: 'Лея', teamId: 'mayak', text: 'Не открывается ссылка на сайт турнира. Это только у меня?', at: startedAt - 81 * 60 * 1000, reply: 'Проверила: ссылка рабочая, попробуй открыть в обычной вкладке. Если нет — напиши ещё раз.' },
    { id: 'q-demo-2', author: 'Тимур', teamId: 'archipelago', text: 'Можно ли уточнить время следующего дедлайна по Москве?', at: startedAt - 11 * 60 * 1000, reply: '' }
  ];

  const freshState = () => ({
    role: sessionRole, stage: 'before', view: 'home', roomId: null, roomTourId: null,
    matrosTeamId: null, captainTeamId: null, adminTeamId: null, adminFilter: 'all', adminTourId: 'tour-1',
    engineUrl: '', joined: {}, teamData: [], createdTeams: [],
    reserveCandidates: [
      { id: 'reserve-maugli', name: 'Мауґли', desiredRole: 'member', status: 'reserve', availability: 'Готов играть', sessionId: null, proposedTeamId: null },
      { id: 'reserve-lada', name: 'Лада', desiredRole: 'member', status: 'reserve', availability: 'Готова играть', sessionId: null, proposedTeamId: null },
      { id: 'reserve-lev', name: 'Лев', desiredRole: 'captain', status: 'reserve', availability: 'Свободен до конца турнира', sessionId: null, proposedTeamId: null },
      { id: 'reserve-sonya', name: 'Соня-Юнга', desiredRole: 'member', status: 'reserve', availability: 'Ждёт свободного слота', sessionId: null, proposedTeamId: null },
      { id: 'reserve-boris', name: 'Борис', desiredRole: 'captain', status: 'reserve', availability: 'Готов вести команду', sessionId: null, proposedTeamId: null },
      { id: 'reserve-ira', name: 'Ира', desiredRole: 'member', status: 'reserve', availability: 'Готова играть', sessionId: null, proposedTeamId: null },
      { id: 'reserve-kira', name: 'Кира', desiredRole: 'member', status: 'reserve', availability: 'Свободна по вечерам', sessionId: null, proposedTeamId: null },
      { id: 'reserve-max', name: 'Макс', desiredRole: 'member', status: 'reserve', availability: 'Готов играть', sessionId: null, proposedTeamId: null },
      { id: 'reserve-nora', name: 'Нора', desiredRole: 'captain', status: 'reserve', availability: 'Готова вести команду', sessionId: null, proposedTeamId: null },
      { id: 'reserve-oleg', name: 'Олег', desiredRole: 'member', status: 'reserve', availability: 'Готов играть', sessionId: null, proposedTeamId: null },
      { id: 'reserve-rina', name: 'Рина', desiredRole: 'member', status: 'reserve', availability: 'Свободна до конца турнира', sessionId: null, proposedTeamId: null },
      { id: 'reserve-stas', name: 'Стас', desiredRole: 'member', status: 'reserve', availability: 'Готов играть', sessionId: null, proposedTeamId: null },
      { id: 'reserve-taya', name: 'Тая', desiredRole: 'captain', status: 'reserve', availability: 'Готова вести команду', sessionId: null, proposedTeamId: null },
      { id: 'reserve-ulyana', name: 'Ульяна', desiredRole: 'member', status: 'reserve', availability: 'Готова играть', sessionId: null, proposedTeamId: null },
      { id: 'reserve-fedya', name: 'Федя', desiredRole: 'member', status: 'reserve', availability: 'Свободен по вечерам', sessionId: null, proposedTeamId: null },
      { id: 'reserve-yana', name: 'Яна', desiredRole: 'member', status: 'reserve', availability: 'Готова играть', sessionId: null, proposedTeamId: null }
    ],
    teamProposals: [],
    storyCards: [],
    storyLikes: {},
    tournament: defaultTournament(), watchPlans: {}, teamAvatars: {}, messages: [], questions: [], replies: {},
    notificationRead: false, readMentionIds: []
  });
  let state = freshState();
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (stored && typeof stored === 'object') {
      state = { ...state, ...stored, role: sessionRole, view: 'home', roomId: null, roomTourId: null };
      if (!['matros', 'captain', 'admiral'].includes(state.role)) state.role = 'matros';
      if (!['before', 'after'].includes(state.stage)) state.stage = 'after';
      if (!state.joined || typeof state.joined !== 'object') state.joined = {};
      if (!Array.isArray(state.createdTeams)) state.createdTeams = [];
      if (!Array.isArray(state.reserveCandidates)) state.reserveCandidates = [];
      if (!Array.isArray(state.teamProposals)) state.teamProposals = [];
      if (!Array.isArray(state.storyCards)) state.storyCards = [];
      if (!state.storyLikes || typeof state.storyLikes !== 'object' || Array.isArray(state.storyLikes)) state.storyLikes = {};
      if (!state.watchPlans || typeof state.watchPlans !== 'object') state.watchPlans = {};
      if (!state.teamAvatars || typeof state.teamAvatars !== 'object' || Array.isArray(state.teamAvatars)) state.teamAvatars = {};
      if (typeof state.engineUrl !== 'string') state.engineUrl = '';
      if (!Array.isArray(state.messages)) state.messages = [];
      if (!Array.isArray(state.questions)) state.questions = [];
      if (!Array.isArray(state.readMentionIds)) state.readMentionIds = [];
      if (!state.replies || typeof state.replies !== 'object') state.replies = {};
      const savedTeamIds = [...(Array.isArray(state.teamData) ? state.teamData : []), ...state.createdTeams].map((team) => team.id);
      if (state.captainTeamId && !savedTeamIds.includes(state.captainTeamId)) state.captainTeamId = null;
      if (state.adminTeamId && !savedTeamIds.includes(state.adminTeamId)) state.adminTeamId = null;
      if (!['all', ...savedTeamIds].includes(state.adminFilter)) state.adminFilter = 'all';
      if (!state.tournament || typeof state.tournament !== 'object') state.tournament = defaultTournament();
      if (!Array.isArray(state.tournament.tours)) state.tournament.tours = defaultTournament().tours;
      if (!Number.isInteger(state.tournament.tourCount)) state.tournament.tourCount = state.tournament.tours.length || 4;
      if (!['preparation', 'active', 'finished'].includes(state.tournament.status)) state.tournament.status = 'preparation';
    }
  } catch (_) { /* sandboxed previews can prohibit localStorage */ }
  const normalizeCrew = (team) => {
    const members = Array.isArray(team.members) ? team.members : [];
    const captain = members.find((member) => member.role === 'captain');
    const normalized = { ...team, official: team.official !== false };
    if (!captain) return { ...normalized, members: members.slice(0, 4) };
    const sailors = members.filter((member) => member !== captain && member.role !== 'captain').slice(0, 3);
    return { ...normalized, members: [captain, ...sailors] };
  };
  function normalizeTour(tour, index) {
    const fallback = makeTour(index + 1);
    const normalized = { ...fallback, ...(tour || {}), id: tour?.id || fallback.id, number: Number(tour?.number) || index + 1 };
    normalized.startAt = Number(normalized.startAt) || fallback.startAt;
    normalized.deadlineAt = Number(normalized.deadlineAt) || normalized.startAt + 3 * 60 * 60 * 1000;
    if (!['planned', 'active', 'completed'].includes(normalized.status)) normalized.status = 'planned';
    return normalized;
  }
  function normalizeTournament(tournament) {
    const base = defaultTournament();
    const normalized = { ...base, ...(tournament || {}) };
    const requested = Math.min(12, Math.max(1, Number(normalized.tourCount) || 4));
    const existing = Array.isArray(normalized.tours) ? normalized.tours : [];
    normalized.tours = Array.from({ length: requested }, (_, index) => normalizeTour(existing[index] || makeTour(index + 1), index));
    normalized.tourCount = requested;
    if (typeof normalized.adminRecoveryCode !== 'string') normalized.adminRecoveryCode = null;
    if (!['preparation', 'active', 'finished'].includes(normalized.status)) normalized.status = 'preparation';
    if (!normalized.tours.some((tour) => tour.id === normalized.activeTourId)) normalized.activeTourId = normalized.tours.find((tour) => tour.status === 'active')?.id || null;
    return normalized;
  }
  state.tournament = normalizeTournament(state.tournament);
  state.createdTeams = state.createdTeams.map(normalizeCrew);
  originalTeams.forEach((team, index) => { originalTeams[index] = normalizeCrew(team); });
  state.teamData = (Array.isArray(state.teamData) ? state.teamData : []).map(normalizeCrew);

  let gateTeamId = null;
  let gatePurpose = 'member';
  let pendingTag = null;
  let toastTimer = 0;
  let lastWatchKey = '';

  const teams = () => [...(Array.isArray(state.teamData) ? state.teamData : []), ...state.createdTeams];
  const officialTeams = () => teams().filter((team) => team.official !== false);
  const teamById = (id) => teams().find((team) => team.id === id);
  const storyCardById = (id) => state.storyCards.find((card) => card.id === id);
  const storyCardsForTour = (tourId, includeUnpublished = false) => state.storyCards.filter((card) => card.tourId === tourId && (includeUnpublished || card.published !== false));
  const updateTeam = (updated) => {
    if (!updated) return;
    const collection = state.teamData.some((team) => team.id === updated.id) ? state.teamData : state.createdTeams;
    const index = collection.findIndex((team) => team.id === updated.id);
    if (index >= 0) collection[index] = normalizeCrew(updated);
  };
  const teamAvatarFor = (team) => team && state.teamAvatars?.[team.id] ? state.teamAvatars[team.id] : '';
  const allTours = () => state.tournament?.tours || [];
  const tourById = (id) => allTours().find((tour) => tour.id === id);
  const activeTour = () => tourById(state.tournament?.activeTourId);
  const roomTour = () => state.role === 'admiral'
    ? tourById(state.roomTourId) || activeTour() || tourById('tour-1')
    : participantTour() || tourById(state.roomTourId) || tourById('tour-1');
  const tourIsEnded = (tour) => Boolean(tour && (tour.status === 'completed' || Date.now() >= Number(tour.deadlineAt)));
  const tourStatusText = (tour) => !tour ? 'подготовка' : tour.status === 'completed' || tourIsEnded(tour) ? 'завершён' : tour.status === 'active' ? 'идёт' : 'запланирован';
  const participantTour = () => state.tournament?.status === 'active' ? activeTour() : null;
  const teamAfterDeadline = (team) => {
    if (state.tournament.status === 'preparation') return state.stage === 'after';
    const tour = roomTour();
    return tour ? tourIsEnded(tour) : (Number.isFinite(team?.deadlineAt) ? Date.now() >= team.deadlineAt : state.stage === 'after');
  };
  const adminCanEdit = () => state.role === 'admiral' && (state.tournament.status === 'preparation' || state.tournament.adminOwnerSessionId === adminSessionId);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const richText = (value) => escapeHtml(value).replace(/(@[А-Яа-яЁёA-Za-z0-9_-]+)/g, '<span class="mention">$1</span>');
  const timeMsk = (ms) => formatTimeMsk.format(new Date(ms));
  const dateMsk = (ms) => formatDateMsk.format(new Date(ms)) + ' МСК';
  const currentMessages = (channel, tourId = roomTour()?.id || 'tour-1') => [...(state.tournament.status === 'finished' ? [] : demoMessages), ...state.messages]
    .filter((message) => message.channel === channel && (channel === 'global' || (teamById(message.teamId) && (message.tourId || 'tour-1') === tourId)))
    .sort((a, b) => a.at - b.at);
  function readAdminPresence() {
    try {
      const saved = JSON.parse(localStorage.getItem(adminPresenceKey) || '{}');
      const now = Date.now();
      const active = Object.fromEntries(Object.entries(saved).filter(([, entry]) => entry && now - Number(entry.touchedAt) < ADMIN_HEARTBEAT_MS * 2.5));
      if (Object.keys(active).length !== Object.keys(saved).length) localStorage.setItem(adminPresenceKey, JSON.stringify(active));
      return active;
    } catch (_) {
      return {};
    }
  }
  function refreshAdminPresence() {
    try {
      const active = readAdminPresence();
      if (state.role === 'admiral' && state.tournament.status !== 'finished') {
        active[adminSessionId] = { touchedAt: Date.now() };
      } else {
        delete active[adminSessionId];
      }
      localStorage.setItem(adminPresenceKey, JSON.stringify(active));
    } catch (_) { /* localStorage can be unavailable in a sandboxed preview */ }
  }
  function activeAdminEntries() {
    refreshAdminPresence();
    const entries = Object.entries(readAdminPresence());
    if (!entries.length && state.role === 'admiral' && state.tournament.status === 'preparation') return [[adminSessionId, { touchedAt: Date.now() }]];
    return entries;
  }
  function activeAdminCount() { return activeAdminEntries().length; }
  const ownsAdminSession = () => state.tournament?.adminOwnerSessionId === adminSessionId;
  function isOwnerAdmin() { return state.role === 'admiral' && ownsAdminSession(); }
  function leaveAdminPresence() {
    try {
      const active = readAdminPresence();
      delete active[adminSessionId];
      localStorage.setItem(adminPresenceKey, JSON.stringify(active));
    } catch (_) { /* continue without presence tracking */ }
  }
  const allQuestions = () => [...(state.tournament.status === 'finished' ? [] : demoQuestions.filter((q) => teamById(q.teamId))), ...state.questions].map((q) => ({ ...q, reply: state.replies[q.id] || q.reply || '' }));
  const captainMemberFor = (teamId) => teamById(teamId)?.members.find((member) => member.role === 'captain') || null;
  const hasCaptainAccess = (teamId = state.captainTeamId) => {
    const captain = captainMemberFor(teamId);
    return Boolean(captain && state.joined[teamId] === captain.name);
  };
  const adminName = () => String(adminDisplayName || '').trim();
  const adminAuthor = () => adminName() ? `Адмирал ${adminName()}` : 'Адмирал';
  const actorForTeam = (teamId) => {
    if (state.role === 'admiral') return adminAuthor();
    if (state.role === 'captain' && teamId === state.captainTeamId && hasCaptainAccess(teamId)) return captainMemberFor(teamId)?.name || 'Капитан';
    return state.joined[teamId] || null;
  };
  const globalIdentity = () => {
    if (state.role === 'admiral') return { author: adminAuthor(), teamId: null, actorType: 'admiral' };
    if (state.role === 'captain') return { author: teamById(state.captainTeamId)?.members.find((member) => member.role === 'captain')?.name || 'Капитан', teamId: state.captainTeamId, actorType: 'captain' };
    const id = state.joined[state.matrosTeamId] && teamById(state.matrosTeamId) ? state.matrosTeamId : Object.keys(state.joined).find((key) => teamById(key));
    if (id) return { author: state.joined[id] || 'Матрос', teamId: id, actorType: 'matros' };
    return { author: sessionDisplayName || 'Юнга', teamId: null, actorType: 'junior', sessionId: adminSessionId };
  };
  if (state.role === 'captain' && !hasCaptainAccess()) {
    state.role = 'matros';
    sessionRole = 'matros';
    try { sessionStorage.setItem('kolfan-role', sessionRole); } catch (_) { /* continue without session storage */ }
  }
  const mentionsForCurrentRole = () => {
    if (state.role === 'admiral') return [];
    const identities = state.role === 'captain'
      ? [{ teamId: state.captainTeamId, name: teamById(state.captainTeamId)?.members[0]?.name }]
      : Object.entries(state.joined).map(([teamId, name]) => ({ teamId, name }));
    return identities.flatMap(({ teamId, name }) => !name ? [] : currentMessages(teamId).filter((m) => m.author !== name && m.text.includes('@' + name)).map((m) => ({ ...m, teamId })))
      .filter((m) => !state.readMentionIds.includes(m.id) && (m.id !== 't1' || !state.notificationRead))
      .sort((a, b) => b.at - a.at);
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ stage: state.stage, matrosTeamId: state.matrosTeamId, captainTeamId: state.captainTeamId, adminTeamId: state.adminTeamId, adminFilter: state.adminFilter, adminTourId: state.adminTourId, roomTourId: state.roomTourId, engineUrl: state.engineUrl, joined: state.joined, teamData: state.teamData, createdTeams: state.createdTeams, reserveCandidates: state.reserveCandidates, teamProposals: state.teamProposals, storyCards: state.storyCards, storyLikes: state.storyLikes, tournament: state.tournament, messages: state.messages, questions: state.questions, replies: state.replies, notificationRead: state.notificationRead, readMentionIds: state.readMentionIds, watchPlans: state.watchPlans, teamAvatars: state.teamAvatars }));
    } catch (_) { /* continue in memory if storage is unavailable */ }
  };
  const toast = (text) => {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3500);
  };
  const scrollToId = (id) => requestAnimationFrame(() => $(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // The schedule is a coordination plan, not a place for game texts. Times are
  // stored as UTC milliseconds; the interface presents them in Moscow time.
  function defaultWatchPlan(team, tourId = roomTour()?.id || 'tour-1') {
    const members = team.members || [];
    const tour = tourById(tourId);
    const base = Number(tour?.startAt) || startedAt - 3 * PERIOD;
    return Array.from({ length: 10 }, (_, index) => ({
      post: index + 1,
      member: members[index % Math.max(1, members.length)]?.name || '—',
      at: base + index * PERIOD
    }));
  }
  function getWatchPlan(team, tourId = roomTour()?.id || 'tour-1') {
    const key = `${tourId}:${team.id}`;
    const saved = state.watchPlans?.[key] || (tourId === 'tour-1' ? state.watchPlans?.[team.id] : null);
    if (Array.isArray(saved) && saved.length === 10) {
      return saved.map((slot, index) => ({ post: index + 1, member: slot.member, at: Number(slot.at) }));
    }
    return defaultWatchPlan(team, tourId);
  }
  function memberByName(team, name) {
    return team.members.find((member) => member.name === name) || team.members[0] || { name: '—' };
  }
  function watchAt(team, now = Date.now(), tourId = roomTour()?.id || 'tour-1') {
    const plan = getWatchPlan(team, tourId);
    let index = plan.findIndex((slot) => now < slot.at);
    if (index === -1) index = plan.length - 1;
    else if (index > 0) index -= 1;
    const current = plan[index];
    const next = plan[index + 1] || { member: plan[0]?.member, at: current.at + PERIOD };
    return { plan, member: memberByName(team, current.member), next: memberByName(team, next.member), index, start: current.at, end: next.at, slot: index };
  }
  function mskInputValue(ms) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  }
  function parseMskInput(value) {
    const parsed = Date.parse(`${value}:00+03:00`);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  function timeRemaining(ms) {
    const min = Math.max(0, Math.ceil(ms / 60000));
    return min >= 60 ? `${Math.floor(min / 60)} ч ${String(min % 60).padStart(2, '0')} мин` : `${min} мин`;
  }

  function setView(view, roomId = null) {
    state.view = view;
    if (roomId) state.roomId = roomId;
    ['home', 'room', 'captain', 'admiral'].forEach((name) => { $(name + 'View').hidden = name !== view; });
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('is-active', (view === 'home' && item.dataset.go === 'home') || (view === 'room' && item.dataset.go === 'watch')));
    renderHeader();
    scrollTop();
  }
  function navigate(where) {
    closeRoleMenu();
    closeNotifications();
    if (where === 'captain') { setRole('captain'); return; }
    if (where === 'admiral') { setRole('admiral'); return; }
    setView('home');
    renderHome();
    if (where === 'rooms') scrollToId('roomsSection');
    if (where === 'lounge') scrollToId('loungeSection');
    if (where === 'watch') scrollToId('watchSection');
  }
  function reopenPreparationAfterFinish() {
    leaveAdminPresence();
    try { localStorage.removeItem(storageKey); } catch (_) { /* continue in memory */ }
    sessionRole = 'admiral';
    try { sessionStorage.setItem('kolfan-role', sessionRole); } catch (_) { /* sessionStorage can be unavailable */ }
    state = freshState();
  }
  function setRole(role) {
    if (!['matros', 'captain', 'admiral'].includes(role)) return;
    const reopenedPreparation = role === 'admiral' && state.tournament.status === 'finished';
    if (reopenedPreparation) reopenPreparationAfterFinish();
    if (role === 'admiral' && state.tournament.status === 'active' && state.role !== 'admiral') {
      openGate(null, 'admiral');
      toast('Введи адмиральский пропуск, сохранённый после запуска турнира.');
      return;
    }
    if (role === 'captain' && !hasCaptainAccess()) {
      openGate(null, 'captain');
      toast('Введи капитанский пропуск любой утверждённой команды.');
      return;
    }
    if (state.role === 'captain' && role === 'matros' && hasCaptainAccess()) {
      toast('Капитанский пропуск уже назначает тебе роль капитана.');
      return;
    }
    if (state.role === 'admiral' && isOwnerAdmin() && state.tournament.status === 'active' && role === 'matros') {
      const testTeam = teamById(state.matrosTeamId) && state.joined[state.matrosTeamId] ? teamById(state.matrosTeamId) : teamById(state.adminTeamId) || teams()[0];
      if (!testTeam) { toast('Сначала адмирал должен создать команду.'); return; }
      if (!testTeam.members.some((member) => member.role !== 'captain')) { toast('Сначала заполни хотя бы один матросский слот.'); return; }
      openGate(testTeam.id, 'member');
      toast('Для проверки во время тура введи личный пропуск матроса.');
      return;
    }
    if (state.role === 'admiral' && role !== 'admiral') leaveAdminPresence();
    state.role = role;
    sessionRole = role;
    try { sessionStorage.setItem('kolfan-role', role); } catch (_) { /* sessionStorage can be unavailable */ }
    if (role === 'admiral') refreshAdminPresence();
    closeRoleMenu();
    closeNotifications();
    setView(role === 'admiral' ? 'admiral' : role === 'captain' ? 'captain' : 'home');
    render();
    save();
    toast(role === 'admiral'
      ? (reopenedPreparation ? 'Предыдущий турнир завершён. Открыта новая подготовка: адмиральский доступ снова свободен.' : state.tournament.status === 'preparation' ? 'Открыта общая подготовительная админка. Перед стартом предупреди команды.' : isOwnerAdmin() ? 'Адмиральское право закреплено за этой сессией.' : 'Открыта админка только для чтения.')
      : role === 'captain' ? 'Открыт капитанский мостик.' : 'Теперь ты матрос. Добро пожаловать на борт!');
  }

  function renderHeader() {
    if (state.role === 'admiral') refreshAdminPresence();
    const role = state.role;
    const identity = globalIdentity();
    const name = role === 'admiral' ? (adminName() || 'Адмирал') : role === 'captain' ? teamById(state.captainTeamId)?.members.find((member) => member.role === 'captain')?.name || teamById(state.captainTeamId)?.members[0]?.name || 'Капитан' : identity.author;
    $('roleAvatar').textContent = name[0] || '✦';
    const adminSuffix = role === 'admiral' && state.tournament.status === 'preparation' ? ' · подготовка' : '';
    const juniorTitle = role === 'matros' && identity.actorType === 'junior' ? (name === 'Юнга' ? 'Юнга' : `Юнга ${name}`) : '';
    const roleTitle = juniorTitle || (role === 'admiral' ? (adminName() ? `Адмирал ${name}` : 'Адмирал') : role === 'captain' ? `Капитан ${name}` : `Матрос ${name}`);
    $('roleTitle').textContent = roleTitle + adminSuffix;
    document.querySelectorAll('[data-role]').forEach((el) => el.setAttribute('aria-current', String(el.dataset.role === role)));
    const unread = role === 'admiral' ? allQuestions().filter((q) => !q.reply).length : mentionsForCurrentRole().length;
    $('notificationCount').hidden = unread === 0;
    $('notificationCount').textContent = unread > 9 ? '9+' : String(unread);
    $('headerClock').textContent = formatClockMsk.format(new Date());
  }
  function renderStage() {
    document.querySelectorAll('[data-stage]').forEach((button) => button.classList.toggle('is-selected', button.dataset.stage === state.stage));
  }

  function renderRooms() {
    const roster = teams();
    $('teamCount').textContent = String(roster.length).padStart(2, '0');
    $('memberCount').textContent = String(roster.reduce((sum, team) => sum + team.members.length, 0)).padStart(2, '0');
    $('roomsGrid').innerHTML = roster.length ? roster.map((team, index) => `
      <button class="room-card theme-${escapeHtml(team.theme || 'ochre')}" type="button" data-open-room="${escapeHtml(team.id)}" aria-label="Открыть каюту команды ${escapeHtml(team.name)}">
        <span class="room-card-top"><span>КОМАНДА ${String(index + 1).padStart(2, '0')}</span><svg class="icon"><use href="#i-spark"/></svg></span>
        ${state.joined[team.id] && state.role === 'matros' ? '<span class="room-card-identity">ТВОЙ ЭКИПАЖ</span>' : ''}
        <strong class="room-card-name">${escapeHtml(team.name)}</strong>
        <span class="room-card-bottom"><span class="room-card-meta"><strong>${team.members.filter((member) => member.role === 'captain').length ? '1 капитан' : 'капитанский слот свободен'} · ${team.members.filter((member) => member.role !== 'captain').length} матроса</strong> <span aria-hidden="true">·</span> ${state.tournament.status === 'preparation' ? 'подготовка' : teamAfterDeadline(team) ? 'чат только для чтения' : 'тур продолжается'}</span><span class="room-card-arrow">${ICON_ARROW}</span></span>
      </button>`).join('') : '<div class="rooms-empty"><strong>Официальных команд пока нет.</strong><span>Адмирал назначит капитана и соберёт первую каюту из скамейки запасных.</span></div>';
  }

  function messageHtml(message, showTeam = true) {
    const team = teamById(message.teamId);
    const tone = message.author.startsWith('Адмирал') ? 'tone-warm' : message.teamId === 'mayak' ? 'tone-teal' : 'tone-blue';
    const moderation = message.channel === 'global' && state.role === 'admiral' && adminCanEdit() && state.messages.some((item) => item.id === message.id)
      ? `<button type="button" class="message-delete" data-delete-message="${escapeHtml(message.id)}">Удалить</button>` : '';
    return `<article class="chat-message"><span class="message-avatar ${tone}" aria-hidden="true">${escapeHtml(message.author[0] || '✦')}</span><div class="message-content"><div class="message-meta"><strong>${escapeHtml(message.author)}</strong>${message.actorType === 'junior' ? '<span class="message-team">· Юнга</span>' : ''}${showTeam && team ? `<span class="message-team">· ${escapeHtml(team.name)}</span>` : ''}<time datetime="${new Date(message.at).toISOString()}" title="Время по Москве">${timeMsk(message.at)}</time></div><p class="message-body">${richText(message.text)}</p>${moderation}</div></article>`;
  }
  function renderGeneral() {
    const panel = $('generalPanel');
    const tour = participantTour();
    const inPreparation = state.tournament.status === 'preparation';
    const waitingForOpen = state.tournament.status === 'active' && !tour;
    const expired = tour ? tourIsEnded(tour) : false;
    const open = state.tournament.status !== 'finished';
    const identity = globalIdentity();
    const isJunior = identity.actorType === 'junior';
    const juniorCandidate = sessionCandidateId && state.reserveCandidates.find((candidate) => candidate.id === sessionCandidateId);
    $('loungeBadge').innerHTML = open ? '<span class="tiny-light" aria-hidden="true"></span> ОТКРЫТА ВСЕГДА' : '<svg class="icon" style="width:13px;height:13px"><use href="#i-lock"/></svg> ЗАВЕРШЕНА';
    $('commonState').textContent = open ? 'Кают-компания открыта' : 'Кают-компания завершена';
    $('commonStateSub').textContent = open ? 'общая лента · пропуск не нужен' : 'данные удалены после завершения';
    $('nextDeadline').textContent = dateMsk(tour?.deadlineAt || nextDeadline);
    if (inPreparation) {
      $('heroKicker').textContent = 'Подготовка к турниру';
      $('heroTitle').innerHTML = 'СОБИРАЕМ<br><em>ЭКИПАЖИ</em>';
      $('heroLead').textContent = 'Здесь можно поздороваться, задать вопрос и попроситься в игру. Для сообщения пропуск не нужен.';
    } else if (waitingForOpen) {
      $('heroKicker').textContent = 'Турнир начат';
      $('heroTitle').innerHTML = 'ЖДЁМ<br><em>ПЕРВЫЙ ТУР</em>';
      $('heroLead').textContent = 'Кают-компания уже открыта. Адмирал вручную откроет первый игровой этап.';
    } else if (expired) {
      $('heroKicker').textContent = `После дедлайна · тур ${tour?.number || 1}`;
      $('heroTitle').innerHTML = 'ТУР ЗАВЕРШИЛСЯ.<br><em>ИДЁТ ГОЛОСОВАНИЕ!</em>';
      $('heroLead').textContent = 'Рассказы и голосование — на странице турнира. Здесь экипажи остаются на связи.';
    } else {
      $('heroKicker').textContent = `Идёт тур ${tour?.number || 1}`;
      $('heroTitle').innerHTML = 'ВЫБЕРИ<br><em>СВОЮ РОЛЬ</em>';
      $('heroLead').textContent = 'Капитанский мостик, матросская каюта или общий разговор без пропуска.';
    }
    if (!open) {
      panel.innerHTML = `<div class="locked-chat"><span class="locked-icon"><svg class="icon"><use href="#i-lock"/></svg></span><div><h3>Турнир завершён.</h3><p>Кают-компания и данные Борта удалены без архива.</p></div></div>`;
      return;
    }
    const ownCandidate = sessionCandidateId ? reserveById(sessionCandidateId) : null;
    const desiredRole = ownCandidate?.desiredRole === 'captain' ? 'captain' : 'member';
    const juniorIdentity = isJunior ? `<div class="junior-compose"><label class="field-label" for="juniorNameInput">ТВОЙ НИК НА БОРТУ</label><input id="juniorNameInput" type="text" maxlength="26" value="${escapeHtml(sessionDisplayName)}" placeholder="Например, Ласточка" required><span class="field-label">КОГО ИЩЕМ В ЭКИПАЖ</span><input id="juniorDesiredRole" type="hidden" value="${desiredRole}"><div class="junior-role-choices" role="group" aria-label="Желаемая роль"><button type="button" class="junior-role-choice ${desiredRole === 'member' ? 'is-selected' : ''}" data-junior-role-choice="member">Хочу в матросы</button><button type="button" class="junior-role-choice ${desiredRole === 'captain' ? 'is-selected' : ''}" data-junior-role-choice="captain">Хочу в капитаны</button></div><small>Пока ты Юнга: каютный пропуск не нужен. Решение о зачислении в экипаж принимает адмирал.</small></div>` : '';
    const benchAction = isJunior
      ? juniorCandidate?.status === 'assigned'
        ? '<div class="junior-bench-state"><span class="tiny-light"></span> Место уже утверждено. Жди новый личный пропуск от капитана.</div>'
        : juniorCandidate
          ? `<div class="junior-bench-state"><span class="tiny-light"></span> Ты уже на скамейке запасных. Если появится место, адмирал и капитаны тебя увидят.</div>`
          : '<button type="button" class="bench-request" data-join-bench>Ищу место в команде</button>'
      : '';
    panel.innerHTML = `<div class="chat-intro"><svg class="icon"><use href="#i-spark"/></svg> Общая Кают-компания · открыта с подготовки до завершения турнира. Читать и писать можно без пропуска.</div><div class="chat-messages" id="generalMessages">${currentMessages('global').map((message) => messageHtml(message)).join('')}</div><form class="chat-composer" id="generalChatForm">${juniorIdentity}<label class="sr-only" for="generalChatText">Сообщение всем экипажам</label><textarea id="generalChatText" rows="2" maxlength="500" placeholder="Напиши в Кают-компанию…" required></textarea><div class="composer-bottom"><span class="composer-tip">Видно всем экипажам</span><div class="composer-actions">${benchAction}<button class="send-button" type="submit" aria-label="Отправить в Кают-компанию"><svg class="icon"><use href="#i-send"/></svg></button></div></div></form>`;
  }
  const storyMessagesFor = (tourId) => state.messages.filter((message) => message.channel === 'story-discussion' && (message.tourId || 'tour-1') === tourId).sort((a, b) => a.at - b.at);
  const storyLikeIds = (messageId) => Array.isArray(state.storyLikes[messageId]) ? state.storyLikes[messageId] : [];
  const storyMessageCard = (message) => storyCardById(message.storyCardId) || { title: message.storyTitle || 'Рассказ', topic: message.storyTopic || 'Тема не указана' };
  function toggleStoryLike(messageId) {
    const message = state.messages.find((item) => item.id === messageId && item.channel === 'story-discussion');
    if (!message) return;
    const liked = storyLikeIds(messageId);
    const index = liked.indexOf(adminSessionId);
    if (index >= 0) liked.splice(index, 1); else liked.push(adminSessionId);
    state.storyLikes[messageId] = liked;
    save();
    renderStoryDiscussion();
    if (state.view === 'admiral') renderStoryAdmin();
  }
  function discussionMessageHtml(message) {
    const card = storyMessageCard(message);
    const team = teamById(message.teamId);
    const liked = storyLikeIds(message.id).includes(adminSessionId);
    const moderation = state.role === 'admiral' && adminCanEdit() ? `<button type="button" class="message-delete" data-delete-discussion="${escapeHtml(message.id)}">Удалить</button>` : '';
    return `<article class="discussion-message"><div class="discussion-message-head"><strong>${escapeHtml(message.author)}</strong><span>${escapeHtml(team?.name || 'Участник без команды')} · Тур ${escapeHtml(String(tourById(message.tourId || 'tour-1')?.number || 1))}</span></div><div class="discussion-attachment"><strong>${escapeHtml(teamById(card.teamId || message.storyTeamId)?.name || team?.name || 'Команда')}</strong><span>«${escapeHtml(card.title)}» · тема: ${escapeHtml(card.topic)}</span></div><p>${richText(message.text)}</p><div class="discussion-message-actions"><button type="button" class="like-button ${liked ? 'is-liked' : ''}" data-like-discussion="${escapeHtml(message.id)}" aria-pressed="${String(liked)}">Нравится <span>${storyLikeIds(message.id).length}</span></button>${moderation}</div></article>`;
  }
  function renderStoryDiscussion() {
    const panel = $('storyDiscussionPanel');
    if (!panel) return;
    const tour = participantTour();
    const actor = globalIdentity();
    const tourLabel = $('storyDiscussionTour');
    const badge = $('storyDiscussionBadge');
    if (tourLabel) tourLabel.textContent = tour ? `Тур ${tour.number}` : 'текущий тур';
    if (actor.actorType === 'junior') {
      if (badge) badge.textContent = 'ДЛЯ УЧАСТНИКОВ';
      panel.innerHTML = '<div class="story-read-note"><svg class="icon"><use href="#i-lock"/></svg> Туровые обсуждения закрыты для Юнги. Сначала получи командный пропуск.</div>';
      return;
    }
    if (!tour) {
      if (badge) badge.textContent = state.tournament.status === 'finished' ? 'ДАННЫЕ УДАЛЕНЫ' : 'ЖДЁМ ОТКРЫТИЯ';
      panel.innerHTML = `<div class="story-empty"><strong>${state.tournament.status === 'finished' ? 'Турнир завершён.' : 'Обсуждение текущего тура ещё не открыто.'}</strong><p>${state.tournament.status === 'finished' ? 'Карточки Борта удалены без архива.' : 'Адмирал откроет тур вручную, а после публикации рассказов внесёт сюда короткие карточки.'}</p></div>`;
      return;
    }
    const ended = tourIsEnded(tour);
    if (badge) badge.textContent = ended ? 'ТОЛЬКО ЧТЕНИЕ' : 'ТЕКУЩИЙ ТУР';
    const cards = storyCardsForTour(tour.id);
    const canWrite = !ended && actor.actorType !== 'junior' && Boolean(actor.teamId) && (actor.actorType === 'captain' ? hasCaptainAccess(actor.teamId) : Boolean(state.joined[actor.teamId]));
    const cardMarkup = cards.length ? `<div class="story-cards">${cards.map((card) => `<article class="story-card"><button type="button" class="story-card-button" data-story-card="${escapeHtml(card.id)}">${escapeHtml(teamById(card.teamId)?.name || 'Команда')}</button><strong>«${escapeHtml(card.title)}»</strong><small>Тема: ${escapeHtml(card.topic)}</small></article>`).join('')}</div>` : '<div class="story-empty"><strong>Карточек пока нет.</strong><p>Адмирал добавит связки команда → название рассказа → тема после публикации на сайте турнира.</p></div>';
    const messages = storyMessagesFor(tour.id);
    let composer = '';
    if (canWrite && cards.length) {
      composer = `<form class="story-discussion-form" id="storyDiscussionForm"><label class="field-label" for="storyCardChoice">ОБСУДИТЬ РАССКАЗ КОМАНДЫ</label><select id="storyCardChoice" required>${cards.map((card) => `<option value="${escapeHtml(card.id)}">${escapeHtml(teamById(card.teamId)?.name || 'Команда')}</option>`).join('')}</select><textarea id="storyDiscussionText" rows="3" maxlength="700" placeholder="Напиши впечатление или разбор…" required></textarea><div class="story-form-bottom"><span>Текст рассказа остаётся на сайте турнира.</span><button type="submit" class="button button-outline">Опубликовать в обсуждении</button></div></form>`;
    } else {
      const text = ended ? 'Дедлайн прошёл: обсуждение этого тура доступно только для чтения.' : actor.actorType === 'junior' ? 'Юнга видит обсуждение, но пишет в него после получения командного пропуска.' : !cards.length ? 'Когда карточки появятся, здесь откроется обсуждение.' : 'Войди в свою каюту по личному пропуску, чтобы писать в обсуждении.';
      composer = `<div class="story-read-note"><svg class="icon"><use href="#i-shield"/></svg>${escapeHtml(text)}</div>`;
    }
    panel.innerHTML = `${cardMarkup}<div class="story-discussion-messages">${messages.length ? messages.map(discussionMessageHtml).join('') : '<p class="story-empty-inline">Пока никто не написал. Можно оставить первое впечатление.</p>'}</div>${composer}`;
  }
  function addStoryCard() {
    if (!adminCanEdit()) { toast('Карточки рассказов вносит только адмирал.'); return; }
    const tourId = $('storyCardTour')?.value;
    const teamId = $('storyCardTeam')?.value;
    const title = $('storyCardTitle')?.value.trim();
    const topic = $('storyCardTopic')?.value.trim();
    if (!tourId || !teamId || !title || !topic) { toast('Заполни тур, команду, название и тему.'); return; }
    if (state.storyCards.some((card) => card.tourId === tourId && card.teamId === teamId)) { toast('Для этой команды в выбранном туре карточка уже есть.'); return; }
    state.storyCards.push({ id: randomId('story'), tourId, teamId, title: title.slice(0, 120), topic: topic.slice(0, 180), published: true });
    save();
    const titleInput = $('storyCardTitle');
    const topicInput = $('storyCardTopic');
    if (titleInput) titleInput.value = '';
    if (topicInput) topicInput.value = '';
    renderAdmiral();
    toast('Карточка рассказа добавлена без текста рассказа.');
  }
  function deleteStoryCard(cardId) {
    if (!adminCanEdit()) { toast('Удалять карточки может только адмирал.'); return; }
    const card = storyCardById(cardId);
    if (!card) return;
    state.storyCards = state.storyCards.filter((item) => item.id !== cardId);
    save();
    renderAdmiral();
    toast(`Карточка команды «${teamById(card.teamId)?.name || '—'}» удалена. Сообщения обсуждения сохранены.`);
  }
  function renderStoryAdmin() {
    const panel = $('storyAdminPanel');
    if (!panel) return;
    const editable = adminCanEdit();
    const tourSelect = $('storyCardTour');
    const teamSelect = $('storyCardTeam');
    if (tourSelect) {
      tourSelect.innerHTML = state.tournament.tours.map((tour) => `<option value="${escapeHtml(tour.id)}">Тур ${tour.number} · ${escapeHtml(tourStatusText(tour))}</option>`).join('');
      tourSelect.disabled = !editable;
    }
    if (teamSelect) {
      teamSelect.innerHTML = officialTeams().map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
      teamSelect.disabled = !editable;
    }
    ['storyCardTitle', 'storyCardTopic'].forEach((id) => { if ($(id)) $(id).disabled = !editable; });
    const form = $('storyCardForm');
    if (form) form.querySelector('button[type="submit"]').disabled = !editable;
    const list = $('storyCardList');
    if (list) {
      const cards = [...state.storyCards].sort((a, b) => (tourById(a.tourId)?.number || 0) - (tourById(b.tourId)?.number || 0) || String(a.teamId).localeCompare(String(b.teamId)));
      list.innerHTML = cards.length ? cards.map((card) => `<article class="admin-story-card"><div><strong>Тур ${escapeHtml(String(tourById(card.tourId)?.number || '?'))} · ${escapeHtml(teamById(card.teamId)?.name || 'Команда')}</strong><span>«${escapeHtml(card.title)}»</span><small>Тема: ${escapeHtml(card.topic)}</small></div>${editable ? `<button type="button" class="button button-quiet" data-delete-story-card="${escapeHtml(card.id)}">Удалить</button>` : ''}</article>`).join('') : '<p class="candidate-empty">Карточек пока нет.</p>';
    }
    const discussionList = $('adminStoryDiscussions');
    if (discussionList) {
      const messages = [...state.messages].filter((message) => message.channel === 'story-discussion').sort((a, b) => b.at - a.at);
      discussionList.innerHTML = messages.length ? messages.map((message) => discussionMessageHtml(message)).join('') : '<p class="candidate-empty">Сообщений в обсуждениях пока нет.</p>';
    }
  }
  function renderMyQuestions() {
    const actor = globalIdentity();
    const my = allQuestions().filter((question) => question.author === actor.author && question.teamId === actor.teamId).sort((a, b) => b.at - a.at)[0];
    $('myQuestions').innerHTML = my ? `<div class="my-question-head">ТВОЙ ПОСЛЕДНИЙ СИГНАЛ</div><div class="my-question"><strong>${my.reply ? 'Адмирал ответил' : 'Ожидает ответа адмирала'}</strong><p>${escapeHtml(my.reply || my.text)}</p><small>${my.reply ? 'Личный ответ на твой вопрос' : 'Видите только вы и адмирал'}</small></div>` : '';
    $('urgentForm').querySelector('button[type="submit"]').disabled = state.role === 'admiral';
  }
  function renderHome() {
    const juniorOnly = globalIdentity().actorType === 'junior';
    $('roomsSection').hidden = juniorOnly;
    $('storyDiscussionSection').hidden = juniorOnly;
    $('watchSection').hidden = juniorOnly;
    renderRooms();
    renderGeneral();
    renderStoryDiscussion();
    $('watchIntro').textContent = state.stage === 'after' ? 'Огонёк показывает текущую вахту.' : 'Огонёк показывает текущую вахту.';
    renderMyQuestions();
    renderWatch();
  }

  function renderWatch() {
    const now = Date.now();
    $('headerClock').textContent = formatClockMsk.format(new Date(now));
    const team = teamById(state.matrosTeamId) || teams()[0];
    if (!team) {
      $('watchTeamName').textContent = 'Команды пока нет';
      $('watchName').textContent = '—';
      $('watchNext').textContent = '—';
      $('watchInterval').textContent = '—';
      $('watchCountdown').textContent = '—';
      $('watchLocal').hidden = true;
      $('callWatch').innerHTML = `Позвать через @упоминание ${ICON_ARROW}`;
      return;
    }
    const tourId = state.view === 'room' ? (roomTour()?.id || 'tour-1') : (participantTour()?.id || 'tour-1');
    const duty = watchAt(team, now, tourId);
    $('watchTeamName').textContent = `Команда «${team.name}»`;
    $('watchName').textContent = duty.member.name;
    $('watchNext').textContent = duty.next.name;
    $('watchInterval').textContent = `${timeMsk(duty.start)}–${timeMsk(duty.end)} МСК`;
    $('watchLocal').hidden = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Moscow';
    $('watchLocal').textContent = `У тебя: ${formatLocalDate.format(new Date(duty.start))}–${formatLocalDate.format(new Date(duty.end))}`;
    $('watchCountdown').textContent = `через ${timeRemaining(duty.end - now)}`;
    $('callWatch').innerHTML = state.role === 'admiral' ? `Посмотреть вахты ${ICON_ARROW}` : `Позвать через @упоминание ${ICON_ARROW}`;
    if (state.stage === 'after' && now >= nextDeadline && $('generalChatForm')) renderGeneral();
    if (state.view === 'room') {
      const roomTeam = teamById(state.roomId);
      const activeKey = `${state.roomTourId || 'tour-1'}-${state.roomId}-${roomTeam ? watchAt(roomTeam, now, state.roomTourId || 'tour-1').index : 0}`;
      if (lastWatchKey !== activeKey) { renderRosterSchedule(); lastWatchKey = activeKey; }
    }
  }

  function renderTeamAvatar(team) {
    const slot = $('teamAvatar');
    if (!slot) return;
    const avatar = teamAvatarFor(team);
    slot.classList.toggle('has-image', Boolean(avatar));
    slot.innerHTML = avatar
      ? `<img src="${escapeHtml(avatar)}" alt="">`
      : `<span aria-hidden="true">${escapeHtml(team.mark || '✦')}</span>`;
    slot.setAttribute('aria-label', avatar ? `Аватар команды «${team.name}»` : `Знак команды «${team.name}»`);
  }

  function renderEngineLink() {
    const slot = $('engineLinkSlot');
    if (!slot) return;
    const url = state.engineUrl.trim();
    const after = teamAfterDeadline(teamById(state.roomId));
    $('engineCardText').textContent = after ? 'Рассказы и голосование — на странице турнира.' : 'Публикации тура — на странице турнира.';
    slot.innerHTML = url
      ? `<a class="briefing-link" id="engineLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><svg class="icon"><use href="#i-anchor"/></svg> ${after ? 'Открыть рассказы и голосование' : 'Открыть сайт турнира'} ${ICON_ARROW}</a>`
      : '<div class="briefing-link briefing-link-empty"><svg class="icon"><use href="#i-anchor"/></svg> Адмирал ещё не добавил общую ссылку</div>';
  }

  function renderRoom() {
    const team = teamById(state.roomId);
    if (!team) { navigate('home'); return; }
    const tour = roomTour();
    const tourId = tour?.id || 'tour-1';
    const after = state.tournament.status === 'preparation' ? state.stage === 'after' : tourIsEnded(tour);
    const readOnly = state.role === 'admiral' || after;
    $('roomTitle').textContent = team.name;
    $('roomDescription').textContent = team.description;
    $('roomSigil').textContent = team.mark;
    $('roomCrewCount').textContent = `${team.members.length} в экипаже`;
    $('roomCountAccent').textContent = String(team.members.length).padStart(2, '0');
    const label = $('roomTourLabel');
    if (label) label.textContent = `ЛИЧНАЯ КАЮТА · ТУР ${tour?.number || 1} · ${after ? 'ЧТЕНИЕ' : 'ВХОД ПО ПРОПУСКУ'}`;
    renderTeamAvatar(team);
    $('roomOpenText').textContent = after ? 'Чат каюты после дедлайна · только чтение' : 'Чат каюты текущего тура открыт';
    $('teamChatSub').textContent = after ? 'Завершённый чат тура не возобновляется.' : 'Бытовые вопросы и договорённости экипажа.';
    $('roomNoticeText').textContent = after ? `Тур ${tour?.number || 1} завершён. Чат каюты сохранён только для чтения.` : `Тур ${tour?.number || 1} идёт до ${dateMsk(tour?.deadlineAt || Date.now())}.`;
    renderEngineLink();
    const messages = currentMessages(team.id, tourId);
    $('teamMessages').innerHTML = messages.length ? messages.map((message) => messageHtml(message, false)).join('') : '<div class="chat-message"><p class="message-body">Здесь пока тихо. Позови экипаж через @упоминание.</p></div>';
    $('teamChatForm').hidden = readOnly;
    $('admiralReadOnlyNote').hidden = !readOnly;
    $('admiralReadOnlyNote').innerHTML = `<svg class="icon"><use href="#i-${state.role === 'admiral' ? 'shield' : 'lock'}"/></svg> ${state.role === 'admiral' ? 'Адмирал читает чат каюты.' : 'Дедлайн прошёл. Завершённый чат доступен только для чтения.'}`;
    renderRosterSchedule();
  }
  function renderRosterSchedule() {
    const team = teamById(state.roomId);
    if (!team) return;
    const duty = watchAt(team, Date.now(), roomTour()?.id || 'tour-1');
    $('rosterList').innerHTML = team.members.map((member) => `<div class="crew-member"><span class="crew-avatar" aria-hidden="true">${escapeHtml(member.name[0])}</span><span class="crew-member-info"><strong>${escapeHtml(member.name)}</strong><small>${duty.member.name === member.name ? 'Сейчас на вахте' : member.role === 'captain' ? 'Капитан' : 'На борту'}</small></span>${duty.member.name === member.name ? '<span class="crew-watch-light" aria-label="Горит огонёк: сейчас на вахте"></span>' : ''}${state.role === 'admiral' ? '' : `<button type="button" class="crew-tag" data-tag-name="${escapeHtml(member.name)}" title="Упомянуть ${escapeHtml(member.name)}" aria-label="Позвать ${escapeHtml(member.name)}">@</button>`}</div>`).join('');
    const now = Date.now();
    const rows = duty.plan.map((slot, i) => {
      const who = memberByName(team, slot.member);
      const next = duty.plan[i + 1];
      const end = next ? next.at : slot.at + PERIOD;
      const active = i === duty.index;
      const status = active ? '● СЕЙЧАС' : slot.at < now ? 'прошла' : 'скоро';
      return `<div class="schedule-row ${active ? 'is-current' : ''}"><span class="schedule-number">${String(i + 1).padStart(2, '0')}</span><span class="schedule-person">${active ? '<span class="crew-watch-light" aria-hidden="true"></span>' : ''}<span>${escapeHtml(who.name)}</span></span><time class="schedule-time" datetime="${new Date(slot.at).toISOString()}" title="Твоё время: ${escapeHtml(formatLocalDate.format(new Date(slot.at)))}–${escapeHtml(formatLocalDate.format(new Date(end)))}">${timeMsk(slot.at)}–${timeMsk(end)}</time><span class="schedule-status">${status}</span></div>`;
    });
    $('scheduleList').innerHTML = rows.join('');
  }

  function renderCaptainSchedule() {
    const team = teamById(state.captainTeamId);
    if (!team) return;
    const plan = getWatchPlan(team, participantTour()?.id || 'tour-1');
    const options = team.members.map((member) => `<option value="${escapeHtml(member.name)}">${escapeHtml(member.name)}</option>`).join('');
    $('captainScheduleEditor').innerHTML = plan.map((slot, index) => `<div class="watch-edit-row"><span class="watch-edit-number">${String(index + 1).padStart(2, '0')}</span><select class="watch-edit-member" data-watch-index="${index}" aria-label="Матрос на пост ${index + 1}">${options}</select><input class="watch-edit-time" data-watch-index="${index}" type="datetime-local" value="${mskInputValue(slot.at)}" aria-label="Время поста ${index + 1} по Москве"><span class="watch-edit-zone">МСК</span></div>`).join('');
    plan.forEach((slot, index) => {
      const select = $('captainScheduleEditor').querySelector(`.watch-edit-member[data-watch-index="${index}"]`);
      if (select) select.value = slot.member;
    });
  }

  function saveCaptainSchedule() {
    if (state.role !== 'captain' || !hasCaptainAccess()) return;
    const team = teamById(state.captainTeamId);
    if (!team) return;
    const rows = [...document.querySelectorAll('#captainScheduleEditor .watch-edit-row')];
    const plan = rows.map((row, index) => ({
      post: index + 1,
      member: row.querySelector('.watch-edit-member').value,
      at: parseMskInput(row.querySelector('.watch-edit-time').value)
    }));
    if (plan.some((slot) => !slot.member || !Number.isFinite(slot.at))) {
      toast('Заполни все вахты и время по Москве.');
      return;
    }
    if (plan.some((slot, index) => index > 0 && slot.at <= plan[index - 1].at)) {
      toast('Время вахт должно идти по порядку.');
      return;
    }
    state.watchPlans[`${participantTour()?.id || 'tour-1'}:${team.id}`] = plan;
    save();
    renderCaptain();
    renderHome();
    if (state.view === 'room' && state.roomId === team.id) renderRoom();
    toast('Вахтенный график изменён. Огонёк уже показывает новый порядок.');
  }

  function renderCaptainAvatarEditor(team) {
    const editor = $('captainAvatarEditor');
    if (!editor) return;
    const avatar = teamAvatarFor(team);
    const avatarUrl = avatar.startsWith('https://') ? avatar : '';
    editor.innerHTML = `<div class="avatar-editor-preview ${avatar ? 'has-image' : ''}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : `<span aria-hidden="true">${escapeHtml(team.mark || '✦')}</span>`}</div><div class="avatar-editor-copy"><div class="field-label">АВАТАР КОМАНДЫ</div><p>Вставь прямую HTTPS-ссылку на картинку.</p><div class="avatar-url-row"><input class="avatar-url-input" id="captainAvatarUrl" type="url" value="${escapeHtml(avatarUrl)}" maxlength="2048" placeholder="https://…/image.jpg" aria-label="Ссылка на аватар команды"><button type="button" class="avatar-save button button-outline" id="saveCaptainAvatar">Сохранить</button></div>${avatar ? `<button type="button" class="avatar-remove" data-remove-avatar="${escapeHtml(team.id)}">Убрать аватар</button>` : ''}</div>`;
  }

  function renderCaptain() {
    const captainTeams = teams().filter((team) => hasCaptainAccess(team.id));
    if (!captainTeams.some((team) => team.id === state.captainTeamId)) state.captainTeamId = captainTeams[0]?.id || null;
    if (!captainTeams.length) { setView('home'); renderHome(); return; }
    $('captainTeamSelect').innerHTML = captainTeams.map((team) => `<option value="${escapeHtml(team.id)}" ${team.id === state.captainTeamId ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');
    const team = teamById(state.captainTeamId);
    if (!team) return;
    renderCaptainAvatarEditor(team);
    const filledPasses = team.members.map((member, index) => `<div class="pass-entry"><span class="crew-avatar" aria-hidden="true">${escapeHtml(member.name[0])}</span><span class="pass-entry-copy"><strong>СЛОТ ${index + 1} · ${escapeHtml(member.name)}${member.role === 'captain' ? ' · капитан' : ''}</strong><small>Пропуск: ${escapeHtml(member.token)}</small></span>${member.role !== 'captain' ? `<button type="button" class="pass-clear" data-captain-clear="${escapeHtml(member.name)}" aria-label="Очистить слот ${escapeHtml(member.name)}" title="Очистить слот">×</button>` : ''}<button type="button" data-copy="${escapeHtml(member.token)}" aria-label="Скопировать пропуск для ${escapeHtml(member.name)}" title="Скопировать пропуск"><svg class="icon"><use href="#i-copy"/></svg></button></div>`);
    const emptyPasses = Array.from({ length: Math.max(0, 4 - team.members.length) }, (_, index) => `<div class="pass-entry pass-entry-empty"><span class="crew-avatar" aria-hidden="true">${index + team.members.length + 1}</span><span class="pass-entry-copy"><strong>СЛОТ ${index + team.members.length + 1} · свободен</strong><small>Новый участник получит новый пропуск после решения адмирала.</small></span></div>`);
    $('passesList').innerHTML = [...filledPasses, ...emptyPasses].join('');
    renderCaptainCandidates(team);
    renderCaptainSchedule();
  }

  function removeTeamAvatar(teamId) {
    if (state.role !== 'captain' || teamId !== state.captainTeamId || !hasCaptainAccess(teamId)) return;
    delete state.teamAvatars[teamId];
    save();
    renderCaptain();
    renderHome();
    if (state.view === 'room' && state.roomId === teamId) renderRoom();
    toast('Аватар команды убран.');
  }

  function saveTeamAvatarUrl() {
    const team = teamById(state.captainTeamId);
    const input = $('captainAvatarUrl');
    if (state.role !== 'captain' || !hasCaptainAccess() || !team || !input) return;
    const raw = input.value.trim();
    if (!raw) {
      delete state.teamAvatars[team.id];
      save();
      renderCaptain();
      if (state.view === 'room' && state.roomId === team.id) renderRoom();
      toast('Аватар команды убран.');
      return;
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      toast('Вставь прямую ссылку на изображение.');
      return;
    }
    if (parsed.protocol !== 'https:') {
      toast('Для аватара нужна HTTPS-ссылка.');
      return;
    }
    state.teamAvatars[team.id] = parsed.toString();
    save();
    renderCaptain();
    renderHome();
    if (state.view === 'room' && state.roomId === team.id) renderRoom();
    toast(`Ссылка на аватар команды «${team.name}» сохранена.`);
  }

  function saveEngineUrl() {
    const input = $('admiralEngineUrl');
    if (!input || state.role !== 'admiral') return;
    const raw = input.value.trim();
    if (!raw) {
      state.engineUrl = '';
      save();
      renderAdmiral();
      if (state.view === 'room') renderRoom();
      toast('Общая ссылка на сайт турнира убрана.');
      return;
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      toast('Вставь ссылку на сайт турнира.');
      return;
    }
    if (parsed.protocol !== 'https:') {
      toast('Для сайта турнира нужна HTTPS-ссылка.');
      return;
    }
    state.engineUrl = parsed.toString();
    save();
    renderAdmiral();
    if (state.view === 'room') renderRoom();
    toast('Общая ссылка сохранена для всех кают.');
  }

  function renderTourSettingsFields() {
    const list = $('tourSettingsList');
    const input = $('tourCountInput');
    if (!list || !input) return;
    const count = Math.min(12, Math.max(1, Number(input.value) || state.tournament.tourCount || 4));
    const editable = state.tournament.status === 'preparation' && adminCanEdit();
    list.innerHTML = Array.from({ length: count }, (_, index) => {
      const tour = state.tournament.tours[index] || makeTour(index + 1);
      return `<div class="tour-setting-row"><div class="tour-setting-number">ТУР ${String(index + 1).padStart(2, '0')}<small>${tourStatusText(tour)}</small></div><label>СТАРТ <input data-tour-start="${index}" type="datetime-local" value="${mskInputValue(tour.startAt)}" ${editable ? '' : 'disabled'}></label><label>ДЕДЛАЙН <input data-tour-deadline="${index}" type="datetime-local" value="${mskInputValue(tour.deadlineAt)}" ${editable ? '' : 'disabled'}></label></div>`;
    }).join('');
  }
  function saveTournamentSettings() {
    if (!adminCanEdit() || state.tournament.status !== 'preparation') {
      toast('Настройки туров можно менять только до начала турнира.');
      return;
    }
    const count = Math.min(12, Math.max(1, Number($('tourCountInput')?.value) || 4));
    const tours = [];
    for (let index = 0; index < count; index += 1) {
      const startAt = parseMskInput($(`[data-tour-start="${index}"]`)?.value || '');
      const deadlineAt = parseMskInput($(`[data-tour-deadline="${index}"]`)?.value || '');
      if (!Number.isFinite(startAt) || !Number.isFinite(deadlineAt) || deadlineAt <= startAt) {
        toast(`Проверь даты тура ${index + 1}: дедлайн должен быть позже старта.`);
        return;
      }
      tours.push({ ...(state.tournament.tours[index] || makeTour(index + 1)), id: `tour-${index + 1}`, number: index + 1, startAt, deadlineAt, status: 'planned', openedAt: null, completedAt: null });
    }
    state.tournament.tourCount = count;
    state.tournament.tours = tours;
    state.adminTourId = tours[0]?.id || null;
    save();
    renderAdmiral();
    toast('Расписание туров сохранено.');
  }
  function startTournament() {
    if (!adminCanEdit() || state.tournament.status !== 'preparation') return;
    const count = activeAdminCount();
    if (count !== 1) {
      toast(`Старт заблокирован: активных админских режимов ${count}. Остальные должны выйти из админки.`);
      return;
    }
    const officialCount = officialTeams().length;
    if (officialCount < MIN_TEAMS) {
      toast(`Для старта нужны минимум ${MIN_TEAMS} официальные команды. Сейчас собрано: ${officialCount}.`);
      return;
    }
    if (officialCount > MAX_TEAMS) {
      toast(`На борту может быть не больше ${MAX_TEAMS} официальных команд.`);
      return;
    }
    const invalid = state.tournament.tours.slice(0, state.tournament.tourCount).some((tour) => !Number.isFinite(Number(tour.startAt)) || !Number.isFinite(Number(tour.deadlineAt)) || Number(tour.deadlineAt) <= Number(tour.startAt));
    if (invalid) {
      toast('Сначала сохрани корректные даты старта и дедлайны всех туров.');
      return;
    }
    if (!window.confirm('После старта право адмирала закрепится за этой сессией до завершения турнира. Адмирал не участвует в игре. Начать турнир?')) return;
    state.tournament.status = 'active';
    state.tournament.startedAt = Date.now();
    state.tournament.adminOwnerSessionId = adminSessionId;
    state.tournament.adminRecoveryCode = state.tournament.adminRecoveryCode || makeRecoveryCode();
    state.tournament.activeTourId = null;
    save();
    render();
    toast(`Турнир начат. Открой первый тур вручную. Адмиральский пропуск: ${state.tournament.adminRecoveryCode}`);
  }
  function openSelectedTour() {
    if (!isOwnerAdmin() || state.tournament.status !== 'active') {
      toast('Открывать туры может только закреплённый адмирал.');
      return;
    }
    const current = activeTour();
    let selected = tourById(state.adminTourId) || state.tournament.tours.find((tour) => tour.status === 'planned');
    if (selected?.status === 'active') selected = state.tournament.tours.find((tour) => tour.status === 'planned');
    if (!selected) {
      toast('Свободных запланированных туров не осталось.');
      return;
    }
    if (current && !tourIsEnded(current)) {
      toast(`Тур ${current.number} ещё не завершён. Следующий можно открыть после дедлайна.`);
      return;
    }
    if (selected.status === 'completed') {
      toast('Завершённый тур нельзя открыть повторно.');
      return;
    }
    if (Date.now() < Number(selected.startAt)) {
      toast(`Тур ${selected.number} ещё не наступил по расписанию.`);
      return;
    }
    if (current) {
      current.status = 'completed';
      current.completedAt = Date.now();
    }
    selected.status = 'active';
    selected.openedAt = Date.now();
    state.tournament.activeTourId = selected.id;
    state.adminTourId = selected.id;
    save();
    render();
    toast(`Тур ${selected.number} открыт. Для участников виден только этот этап.`);
  }
  function finishTournament() {
    if (!isOwnerAdmin() || state.tournament.status !== 'active') {
      toast('Завершить турнир может только закреплённый адмирал.');
      return;
    }
    if (!window.confirm('Финальные результаты объявлены? После подтверждения данные Борта удалятся без архива.')) return;
    leaveAdminPresence();
    try { localStorage.removeItem(storageKey); } catch (_) { /* continue in memory */ }
    sessionRole = 'matros';
    try { sessionStorage.setItem('kolfan-role', sessionRole); } catch (_) { /* sessionStorage can be unavailable */ }
    state = freshState();
    state.teamData = [];
    state.createdTeams = [];
    state.reserveCandidates = [];
    state.teamProposals = [];
    state.storyCards = [];
    state.storyLikes = {};
    state.messages = [];
    state.questions = [];
    state.replies = {};
    state.tournament = { ...state.tournament, status: 'finished', tourCount: 0, tours: [], activeTourId: null, adminOwnerSessionId: null, startedAt: null, finishedAt: Date.now() };
    setView('home');
    render();
    toast('Турнир завершён. Данные Борта удалены без архива.');
  }
  function renderAdminTransfer() {
    const panel = $('adminTransferPanel');
    if (!panel) return;
    const current = activeTour();
    const allowed = isOwnerAdmin() && state.tournament.status === 'active' && (!current || tourIsEnded(current));
    const candidates = activeAdminEntries().filter(([id]) => id !== adminSessionId);
    if (!allowed) {
      panel.innerHTML = '<span>Передача полномочий доступна в межтурный период. Сейчас она недоступна.</span>';
      return;
    }
    panel.innerHTML = candidates.length
      ? `<strong>Передать полномочия:</strong>${candidates.map(([id]) => `<button type="button" data-transfer-admin="${escapeHtml(id)}">другая активная админка · ${escapeHtml(id.slice(-6))}</button>`).join('')}`
      : '<span>Чтобы передать полномочия, другой человек должен открыть админский режим в своей вкладке.</span>';
  }
  function transferAdmin(targetSessionId) {
    if (!isOwnerAdmin() || state.tournament.status !== 'active') { toast('Передать полномочия может только закреплённый адмирал.'); return; }
    const current = activeTour();
    if (current && !tourIsEnded(current)) { toast('Передача доступна между турами, после дедлайна текущего этапа.'); return; }
    if (!activeAdminEntries().some(([id]) => id === targetSessionId)) { toast('Эта админская сессия больше не активна.'); return; }
    state.tournament.adminOwnerSessionId = targetSessionId;
    save();
    render();
    toast('Полномочия переданы. Теперь эта админка работает только для чтения.');
  }
  function ensureAdminRecoveryCode() {
    if (state.tournament.status !== 'active' || !isOwnerAdmin()) return '';
    if (!state.tournament.adminRecoveryCode) {
      state.tournament.adminRecoveryCode = makeRecoveryCode();
      save();
    }
    return state.tournament.adminRecoveryCode;
  }
  function renderLiveAdminTools() {
    const recoveryPanel = $('adminRecoveryCodePanel');
    const recoveryInput = $('adminRecoveryCodeValue');
    const recoveryVisible = state.tournament.status === 'active' && isOwnerAdmin();
    if (recoveryPanel) recoveryPanel.hidden = !recoveryVisible;
    if (recoveryInput) recoveryInput.value = recoveryVisible ? ensureAdminRecoveryCode() : '';
    const current = activeTour();
    const editable = isOwnerAdmin() && state.tournament.status === 'active' && Boolean(current) && !tourIsEnded(current);
    const deadlineInput = $('activeTourDeadline');
    const deadlineButton = $('saveActiveTourDeadline');
    const emergencyButton = $('emergencyFinishTour');
    const note = $('activeTourDeadlineNote');
    if (deadlineInput) {
      if (document.activeElement !== deadlineInput) deadlineInput.value = current ? mskInputValue(current.deadlineAt) : '';
      deadlineInput.disabled = !editable;
    }
    if (deadlineButton) deadlineButton.disabled = !editable;
    if (emergencyButton) emergencyButton.disabled = !editable;
    if (note) note.textContent = !current ? 'Открой тур, чтобы изменить его дедлайн.' : tourIsEnded(current) ? 'Тур уже завершён. Сроки завершённого этапа не меняются.' : editable ? `Тур ${current.number}: можно поставить срок в прошлом для проверки завершения.` : 'Изменять срок может только закреплённый адмирал.';

    const teamSelect = $('demoTestTeam');
    const matrosButton = $('demoTestMatros');
    const captainButton = $('demoTestCaptain');
    const selectedTestTeamId = $('demoTestTeam')?.value || state.adminTeamId || teams()[0]?.id;
    const testTeam = teamById(selectedTestTeamId) || teams()[0];
    const hasSailor = Boolean(testTeam?.members.some((member) => member.role !== 'captain'));
    if (teamSelect) {
      teamSelect.innerHTML = teams().map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
      teamSelect.value = state.adminTeamId && teamById(state.adminTeamId) ? state.adminTeamId : teams()[0]?.id || '';
      teamSelect.disabled = !editable || !teams().length;
    }
    if (matrosButton) { matrosButton.disabled = !editable || !hasSailor; matrosButton.title = hasSailor ? '' : 'Сначала заполни хотя бы один матросский слот.'; }
    if (captainButton) captainButton.disabled = !editable || !teams().length;
  }
  function saveActiveTourDeadline() {
    if (!isOwnerAdmin() || state.tournament.status !== 'active') { toast('Менять дедлайн может только закреплённый адмирал во время турнира.'); return; }
    const tour = activeTour();
    const deadline = parseMskInput($('activeTourDeadline')?.value || '');
    if (!tour) { toast('Сначала открой текущий тур.'); return; }
    if (tourIsEnded(tour)) { toast('Этот тур уже завершён и не возобновляется.'); return; }
    if (!Number.isFinite(deadline) || deadline <= Number(tour.startAt)) { toast('Дедлайн должен быть позже старта тура.'); return; }
    tour.deadlineAt = deadline;
    save();
    render();
    toast(`Дедлайн тура ${tour.number} передвинут на ${dateMsk(deadline)}.`);
  }
  function emergencyFinishTour() {
    if (!isOwnerAdmin() || state.tournament.status !== 'active') { toast('Аварийно завершить тур может только закреплённый адмирал.'); return; }
    const tour = activeTour();
    if (!tour) { toast('Сейчас нет открытого тура.'); return; }
    if (!window.confirm(`Аварийно завершить тур ${tour.number} прямо сейчас? После этого участники увидят его только для чтения.`)) return;
    tour.status = 'completed';
    tour.completedAt = Date.now();
    tour.deadlineAt = Math.min(Number(tour.deadlineAt) || Date.now(), Date.now());
    state.tournament.activeTourId = null;
    state.adminTourId = state.tournament.tours.find((item) => item.status === 'planned')?.id || tour.id;
    save();
    render();
    toast(`Тур ${tour.number} аварийно завершён. Его чаты доступны для чтения.`);
  }
  function renderAdminTourControls() {
    const select = $('admiralTourFilter');
    if (!select) return;
    const current = activeTour();
    renderAdminTransfer();
    if (!tourById(state.adminTourId)) state.adminTourId = current?.id || state.tournament.tours[0]?.id || null;
    select.innerHTML = state.tournament.tours.map((tour) => `<option value="${escapeHtml(tour.id)}">Тур ${tour.number} · ${escapeHtml(tourStatusText(tour))}</option>`).join('');
    select.value = state.adminTourId || '';
    const summary = $('admiralTourSummary');
    const next = state.tournament.tours.find((tour) => tour.status === 'planned');
    const completed = state.tournament.tours.find((tour) => tour.status === 'completed');
    if (summary) summary.innerHTML = state.tournament.status === 'preparation'
      ? '<strong>Подготовка открыта.</strong><span>После сохранения расписания адмирал попросит команды выйти из админки.</span>'
      : state.tournament.status === 'finished'
        ? '<strong>Турнир завершён.</strong><span>Данные Борта удалены без архива.</span>'
        : current
          ? `<strong>Сейчас тур ${current.number}: ${escapeHtml(tourStatusText(current))}.</strong><span>Дедлайн: ${escapeHtml(dateMsk(current.deadlineAt))}. Завершённые этапы не возобновляются.</span>`
          : completed && next
            ? `<strong>Тур ${completed.number} завершён.</strong><span>Можно открыть тур ${next.number} вручную.</span>`
            : '<strong>Первый тур ещё не открыт.</strong><span>Выбери тур и нажми «Открыть тур» вручную.</span>';
    const openButton = $('openSelectedTour');
    if (openButton) openButton.disabled = !isOwnerAdmin() || !next || Boolean(current && !tourIsEnded(current));
    const finishButton = $('finishTournament');
    if (finishButton) finishButton.disabled = !isOwnerAdmin();
    renderLiveAdminTools();
  }
  function renderAdminBenchAssign(team, editable) {
    const panel = $('admiralBenchAssign');
    if (!panel || !team) return;
    const free = Math.max(0, 4 - team.members.length);
    if (!free) {
      panel.innerHTML = '<div class="bench-assign-note"><strong>Все четыре слота заняты.</strong><span>Новый участник появится только после очистки существующего слота.</span></div>';
      return;
    }
    const candidates = state.reserveCandidates.filter((candidate) => ['reserve', 'proposed', 'approved'].includes(candidate.status));
    if (!editable) {
      panel.innerHTML = `<div class="bench-assign-note"><strong>Свободных слотов: ${free}.</strong><span>Заполнить их кандидатами может только адмирал с правом редактирования.</span></div>`;
      return;
    }
    if (!candidates.length) {
      panel.innerHTML = `<div class="bench-assign-note"><strong>Свободных слотов: ${free}.</strong><span>На скамейке пока нет кандидатов для этой команды.</span></div>`;
      return;
    }
    const hasCaptain = team.members.some((member) => member.role === 'captain');
    panel.innerHTML = `<div class="field-label">ЗАПОЛНИТЬ СВОБОДНЫЙ СЛОТ ИЗ СКАМЕЙКИ</div><p class="bench-assign-help">Команда «${escapeHtml(team.name)}» · свободных слотов: ${free}. Адмирал выбирает кандидата, роль и выдаёт новый пропуск.</p><form id="adminAssignBenchForm" class="bench-assign-form"><label class="sr-only" for="adminBenchCandidate">Кандидат со скамейки</label><select id="adminBenchCandidate" required><option value="">Выбрать кандидата</option>${candidates.map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)} · ${candidate.desiredRole === 'captain' ? 'хочет быть капитаном' : 'хочет быть матросом'}</option>`).join('')}</select><label class="sr-only" for="adminBenchRole">Роль в свободном слоте</label><select id="adminBenchRole" required><option value="member">Матросский слот</option><option value="captain" ${hasCaptain ? 'disabled' : ''}>Капитанский слот</option></select><button type="submit" class="button button-outline">Зачислить и выдать пропуск</button></form>`;
  }
  function renderAdminRoster() {
    const select = $('admiralTeamSelect');
    const list = $('admiralRoster');
    if (!select || !list) return;
    if (!teamById(state.adminTeamId)) state.adminTeamId = teams()[0]?.id || null;
    select.innerHTML = teams().map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
    select.value = state.adminTeamId || '';
    const team = teamById(state.adminTeamId);
    if (!team) {
      list.innerHTML = '';
      const benchPanel = $('admiralBenchAssign');
      if (benchPanel) benchPanel.innerHTML = '<div class="bench-assign-note"><strong>Команд пока нет.</strong><span>Сначала создай официальную команду из скамейки запасных.</span></div>';
      return;
    }
    const editable = adminCanEdit();
    const filled = team.members.map((member, index) => `<div class="admin-roster-entry"><span class="crew-avatar" aria-hidden="true">${escapeHtml(member.name[0] || '✦')}</span><div><strong>СЛОТ ${index + 1} · ${escapeHtml(member.name)}</strong><small>${member.role === 'captain' ? 'Капитан · пропуск можно выдать адмиралом' : 'Матрос'} · пропуск действует</small></div><div class="admin-roster-actions">${member.role === 'captain' ? `<button type="button" data-admin-issue-captain-pass="${escapeHtml(team.id)}" ${editable ? '' : 'disabled'}>Выдать капитанский пропуск</button><button type="button" data-admin-demote="${escapeHtml(member.name)}" ${editable ? '' : 'disabled'}>В матросы</button>` : `<button type="button" data-admin-promote="${escapeHtml(member.name)}" ${editable ? '' : 'disabled'}>Сделать капитаном</button>`}<button type="button" data-admin-clear="${escapeHtml(member.name)}" ${editable ? '' : 'disabled'}>Очистить слот</button><button type="button" class="danger-button" data-admin-dismiss="${escapeHtml(member.name)}" ${editable ? '' : 'disabled'}>Списать</button></div></div>`);
    const empty = Array.from({ length: Math.max(0, 4 - team.members.length) }, (_, index) => `<div class="admin-roster-entry admin-roster-empty"><span class="crew-avatar" aria-hidden="true">${team.members.length + index + 1}</span><div><strong>СЛОТ ${team.members.length + index + 1} · свободен</strong><small>Можно заполнить только новым утверждённым участником.</small></div></div>`);
    list.innerHTML = [...filled, ...empty].join('');
    renderAdminBenchAssign(team, editable);
  }
  function assignCandidateToTeam() {
    if (!adminCanEdit()) { toast('Зачислить кандидата может только адмирал с правом редактирования.'); return; }
    const team = teamById(state.adminTeamId);
    const candidate = reserveById($('adminBenchCandidate')?.value);
    const role = $('adminBenchRole')?.value === 'captain' ? 'captain' : 'member';
    if (!team || !candidate) { toast('Выбери кандидата со скамейки.'); return; }
    if (team.members.length >= 4) { toast('В этой команде уже заняты все четыре слота.'); return; }
    if (!['reserve', 'proposed', 'approved'].includes(candidate.status)) { toast('Этот кандидат уже зачислен в другую команду.'); return; }
    if (role === 'captain' && team.members.some((member) => member.role === 'captain')) { toast('В команде уже есть капитанский слот.'); return; }
    const token = candidateToken();
    team.members.push({ name: candidate.name, role, token });
    candidate.status = 'assigned';
    candidate.proposedTeamId = team.id;
    state.teamProposals.filter((proposal) => proposal.candidateId === candidate.id).forEach((proposal) => { proposal.status = 'invited'; });
    updateTeam(team);
    save();
    render();
    copyPass(token);
    toast(`${candidate.name} зачислен в «${team.name}». Новый пропуск подготовлен для передачи.`);
  }
  function issueCaptainPass(teamId) {
    if (!adminCanEdit()) { toast('Выдать капитанский пропуск может только адмирал с правом редактирования.'); return; }
    const team = teamById(teamId);
    const captain = team?.members.find((member) => member.role === 'captain');
    if (!team || !captain) { toast('Сначала назначь капитана в этой команде.'); return; }
    if (!captain.token) captain.token = candidateToken();
    updateTeam(team);
    save();
    renderAdminRoster();
    copyPass(captain.token);
    toast(`Капитанский пропуск для «${team.name}» подготовлен. Передай его капитану лично.`);
  }
  function adminChangeMember(action, memberName) {
    if (!adminCanEdit()) { toast('Эта админка сейчас только для чтения.'); return; }
    const team = teamById(state.adminTeamId);
    if (!team) return;
    const member = team.members.find((item) => item.name === memberName);
    if (!member) return;
    if (action === 'promote') {
      team.members.forEach((item) => { item.role = item.name === memberName ? 'captain' : 'member'; });
      team.members.sort((a, b) => (a.role === 'captain' ? -1 : 1) - (b.role === 'captain' ? -1 : 1));
      toast(`${memberName} назначен капитаном. Прежний капитан переведён в матросы.`);
    } else if (action === 'demote') {
      member.role = 'member';
      toast(`${memberName} переведён в матросы. Капитанский слот свободен.`);
    } else {
      const removedCurrentCaptain = state.role === 'captain' && state.captainTeamId === team.id && member.role === 'captain' && state.joined[team.id] === memberName;
      team.members = team.members.filter((item) => item.name !== memberName);
      if (state.joined[team.id] === memberName) delete state.joined[team.id];
      if (removedCurrentCaptain) {
        state.role = 'matros';
        sessionRole = 'matros';
        try { sessionStorage.setItem('kolfan-role', sessionRole); } catch (_) { /* continue without session storage */ }
      }
      toast(action === 'dismiss' ? `${memberName} списан. Его пропуск больше не работает.` : `Слот ${memberName} очищен. Старые сообщения сохранены.`);
    }
    updateTeam(team);
    save();
    render();
  }
  function captainClearSailor(memberName) {
    if (state.role !== 'captain' || !hasCaptainAccess()) return;
    const team = teamById(state.captainTeamId);
    const member = team?.members.find((item) => item.name === memberName);
    if (!team || !member || member.role === 'captain') return;
    team.members = team.members.filter((item) => item.name !== memberName);
    if (state.joined[team.id] === memberName) delete state.joined[team.id];
    updateTeam(team);
    save();
    renderCaptain();
    renderHome();
    toast(`Слот матроса ${memberName} очищен. Старые сообщения не переписаны.`);
  }
  function joinReserveBench() {
    const input = $('juniorNameInput');
    const name = (input?.value || sessionDisplayName).trim();
    const desiredRole = $('juniorDesiredRole')?.value === 'captain' ? 'captain' : 'member';
    if (!name) { toast('Сначала укажи ник для общего борта.'); $('juniorNameInput')?.focus(); return; }
    sessionDisplayName = name.slice(0, 26);
    sessionCandidateId = sessionCandidateId || randomId('reserve');
    try {
      sessionStorage.setItem('kolfan-display-name', sessionDisplayName);
      sessionStorage.setItem('kolfan-candidate-id', sessionCandidateId);
    } catch (_) { /* continue without session storage */ }
    let candidate = reserveById(sessionCandidateId);
    if (candidate?.status === 'assigned') {
      toast('Твоё место уже утверждено адмиралом. Жди новый личный пропуск от капитана.');
      return;
    }
    if (!candidate) {
      candidate = { id: sessionCandidateId, name: sessionDisplayName, desiredRole, status: 'reserve', availability: 'Ждёт свободного места', sessionId: adminSessionId, proposedTeamId: null };
      state.reserveCandidates.push(candidate);
    } else {
      candidate.name = sessionDisplayName;
      candidate.desiredRole = desiredRole;
      candidate.status = candidate.status === 'assigned' ? 'assigned' : 'reserve';
    }
    save();
    render();
    toast('Ты на скамейке запасных. Если появится место, тебя позовут.');
  }

  function reserveById(id) {
    return state.reserveCandidates.find((candidate) => candidate.id === id);
  }
  function proposalFor(candidateId, teamId) {
    return state.teamProposals.find((proposal) => proposal.candidateId === candidateId && proposal.teamId === teamId && proposal.status !== 'invited');
  }
  function candidateToken() {
    return randomId('DEMO').toUpperCase();
  }
  function proposeCandidate(candidateId) {
    if (state.role !== 'captain' || !hasCaptainAccess()) return;
    const team = teamById(state.captainTeamId);
    const candidate = reserveById(candidateId);
    if (!team || !candidate || candidate.status !== 'reserve') return;
    if (team.members.length >= 4) { toast('В команде нет свободного слота.'); return; }
    if (proposalFor(candidateId, team.id)) { toast('Кандидат уже предложен адмиралу.'); return; }
    candidate.status = 'proposed';
    candidate.proposedTeamId = team.id;
    state.teamProposals.push({ id: randomId('proposal'), candidateId, teamId: team.id, status: 'pending', at: Date.now() });
    save();
    render();
    toast(`Кандидат ${candidate.name} предложен адмиралу для команды «${team.name}».`);
  }
  function approveCandidateProposal(proposalId) {
    if (!adminCanEdit()) { toast('Только адмирал может утвердить состав.'); return; }
    const proposal = state.teamProposals.find((item) => item.id === proposalId);
    const candidate = proposal && reserveById(proposal.candidateId);
    const team = proposal && teamById(proposal.teamId);
    if (!proposal || !candidate || !team) return;
    if (team.members.length >= 4) { toast('В выбранной команде уже заняты все слоты.'); return; }
    proposal.status = 'approved';
    candidate.status = 'approved';
    candidate.proposedTeamId = team.id;
    save();
    render();
    toast(`Адмирал разрешил пригласить ${candidate.name} в «${team.name}».`);
  }
  function inviteApprovedCandidate(candidateId) {
    if (state.role !== 'captain' || !hasCaptainAccess()) return;
    const team = teamById(state.captainTeamId);
    const candidate = reserveById(candidateId);
    const proposal = candidate && proposalFor(candidateId, team?.id);
    if (!team || !candidate || !proposal || proposal.status !== 'approved') {
      toast('Сначала нужно разрешение адмирала.');
      return;
    }
    if (team.members.length >= 4) { toast('В команде нет свободного слота.'); return; }
    team.members.push({ name: candidate.name, role: 'member', token: candidateToken() });
    candidate.status = 'assigned';
    proposal.status = 'invited';
    updateTeam(team);
    save();
    render();
    toast(`${candidate.name} приглашён в свободный слот «${team.name}». Новый пропуск готов.`);
  }
  function createTeamFromBench() {
    if (!adminCanEdit() || state.tournament.status !== 'preparation') { toast('Новую команду из скамейки собирают только до старта турнира.'); return; }
    if (officialTeams().length >= MAX_TEAMS) { toast(`Достигнут предел: ${MAX_TEAMS} официальных команд.`); return; }
    const name = $('assemblyTeamName')?.value.trim();
    const captainId = $('assemblyCaptainCandidate')?.value;
    const selected = [...document.querySelectorAll('#assemblyBenchChoices input[type="checkbox"]:checked')].map((input) => input.value);
    if (!name || selected.length < 1 || selected.length > 4 || !selected.includes(captainId)) {
      toast('Выбери от одного до четырёх кандидатов и обязательно назначь капитана из них.');
      return;
    }
    const normalizedName = name.toLocaleLowerCase('ru-RU');
    if (teams().some((team) => String(team.name || '').trim().toLocaleLowerCase('ru-RU') === normalizedName)) {
      toast('Команда с таким названием уже есть. Придумай уникальное название.');
      return;
    }
    const candidates = selected.map(reserveById);
    if (candidates.some((candidate) => !candidate || !['reserve', 'proposed', 'approved'].includes(candidate.status))) {
      toast('Кто-то из выбранных кандидатов уже занят. Обнови скамейку.');
      return;
    }
    const id = 'crew-' + Date.now().toString(36);
    const members = candidates.map((candidate) => ({ name: candidate.name, role: candidate.id === captainId ? 'captain' : 'member', token: candidateToken() }));
    members.sort((a, b) => (a.role === 'captain' ? -1 : 1) - (b.role === 'captain' ? -1 : 1));
    const team = { id, name: name.slice(0, 44), mark: '✦', theme: 'teal', description: 'Команда собрана адмиралом из скамейки запасных.', demoName: members[1]?.name || members[0]?.name, adminCreated: true, official: true, members };
    state.createdTeams.push(team);
    candidates.forEach((candidate) => {
      candidate.status = 'assigned';
      candidate.proposedTeamId = id;
      state.teamProposals.filter((proposal) => proposal.candidateId === candidate.id).forEach((proposal) => { proposal.status = 'invited'; });
    });
    state.adminTeamId = id;
    state.captainTeamId = id;
    save();
    render();
    toast(`Команда «${team.name}» создана из ${members.length} ${members.length === 1 ? 'кандидата' : 'кандидатов'}. Капитан назначен адмиралом.`);
  }
  function renderCaptainCandidates(team) {
    const panel = $('captainInvitePanel');
    if (!panel || !team) return;
    const free = Math.max(0, 4 - team.members.length);
    const candidates = state.reserveCandidates.filter((candidate) => ['reserve', 'proposed', 'approved'].includes(candidate.status));
    const rows = candidates.map((candidate) => {
      const proposal = proposalFor(candidate.id, team.id);
      const status = proposal?.status === 'approved' ? 'Адмирал разрешил приглашение' : proposal ? 'Предложен адмиралу' : candidate.status === 'approved' ? 'Одобрен для другой команды' : 'Свободен на скамейке';
      const action = proposal?.status === 'approved' ? `<button type="button" class="button button-outline" data-captain-invite="${escapeHtml(candidate.id)}" ${free ? '' : 'disabled'}>Пригласить</button>` : proposal ? '<span class="candidate-wait">Ждёт решения адмирала</span>' : candidate.status === 'reserve' ? `<button type="button" class="button button-quiet" data-captain-propose="${escapeHtml(candidate.id)}" ${free ? '' : 'disabled'}>Предложить адмиралу</button>` : '<span class="candidate-wait">Уже рассматривается адмиралом</span>';
      const desiredRole = candidate.desiredRole === 'captain' ? 'хочет быть капитаном' : 'хочет быть матросом';
      return `<div class="candidate-row"><span class="crew-avatar" aria-hidden="true">${escapeHtml(candidate.name[0] || '✦')}</span><div><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.availability)} · ${desiredRole} · ${status}</small></div>${action}</div>`;
    }).join('');
    panel.innerHTML = `<div class="eyebrow">СКАМЕЙКА ЗАПАСНЫХ</div><h3>Найти игрока</h3><p>Капитан предлагает кандидата, но состав утверждает адмирал. Свободных слотов: ${free}.</p>${rows || '<p class="candidate-empty">На скамейке пока никого нет.</p>'}`;
  }
  function renderAdminAssembly() {
    const panel = $('adminAssemblyPanel');
    if (!panel) return;
    const editable = adminCanEdit() && state.tournament.status === 'preparation';
    const proposalEditable = adminCanEdit();
    const candidates = state.reserveCandidates.filter((candidate) => ['reserve', 'proposed', 'approved'].includes(candidate.status));
    const captainSelect = $('assemblyCaptainCandidate');
    const choices = $('assemblyBenchChoices');
    if (captainSelect) captainSelect.innerHTML = `<option value="">Выбрать капитана</option>${candidates.map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)}</option>`).join('')}`;
    if (choices) choices.innerHTML = candidates.length ? candidates.map((candidate) => `<label class="bench-check"><input type="checkbox" value="${escapeHtml(candidate.id)}" ${editable ? '' : 'disabled'}><span><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.availability)} · ${candidate.desiredRole === 'captain' ? 'хочет быть капитаном' : 'хочет быть матросом'}${candidate.status === 'proposed' ? ' · ждёт решения' : ''}</small></span></label>`).join('') : '<p class="message-body">На скамейке пока никого нет.</p>';
    const createForm = $('adminCreateTeamForm');
    if (createForm) createForm.querySelectorAll('input, select, button').forEach((control) => { control.disabled = !editable || officialTeams().length >= MAX_TEAMS; });
    const proposalList = $('adminProposals');
    if (proposalList) {
      const proposals = state.teamProposals.filter((proposal) => proposal.status === 'pending' || proposal.status === 'approved');
      proposalList.innerHTML = proposals.length ? proposals.map((proposal) => { const candidate = reserveById(proposal.candidateId); const team = teamById(proposal.teamId); return `<div class="proposal-row"><div><strong>${escapeHtml(candidate?.name || 'Кандидат')}</strong><small>в команду «${escapeHtml(team?.name || '—')}» · ${proposal.status === 'approved' ? 'разрешено приглашение' : 'ждёт решения'}</small></div>${proposal.status === 'pending' ? `<button type="button" class="button button-outline" data-admin-approve-proposal="${escapeHtml(proposal.id)}" ${proposalEditable ? '' : 'disabled'}>Разрешить</button>` : '<span class="candidate-wait">Капитан может пригласить</span>'}</div>`; }).join('') : '<p class="candidate-empty">Новых предложений нет.</p>';
    }
  }

  function renderAdminIdentity() {
    const input = $('adminNameInput');
    const note = $('adminIdentityNote');
    if (input && document.activeElement !== input) input.value = adminName();
    if (note) note.textContent = adminName() ? `Сообщения будут подписаны «Адмирал ${escapeHtml(adminName())}».` : 'Имя ещё не выбрано. Пока сообщения будут подписаны просто «Адмирал».';
  }
  function saveAdminName() {
    if (state.role !== 'admiral') return;
    const input = $('adminNameInput');
    const name = (input?.value || '').trim().replace(/^адмирал\s+/i, '').slice(0, 26);
    if (!name) { toast('Введи имя, под которым тебя увидит экипаж.'); input?.focus(); return; }
    adminDisplayName = name;
    try { sessionStorage.setItem('kolfan-admin-display-name', adminDisplayName); } catch (_) { /* sessionStorage can be unavailable */ }
    render();
    toast(`Теперь экипаж видит тебя как «Адмирал ${adminDisplayName}».`);
  }
  function renderAdmiral() {
    const preparation = state.tournament.status === 'preparation';
    const owner = isOwnerAdmin();
    renderAdminIdentity();
    const prepCard = $('admiralPreparation');
    const liveCard = $('admiralLiveControls');
    if (prepCard) prepCard.hidden = !preparation;
    if (liveCard) liveCard.hidden = preparation;
    $('admiralTeamCount').textContent = String(officialTeams().length).padStart(2, '0');
    $('admiralChatCount').textContent = String(officialTeams().length * Math.max(1, state.tournament.tourCount)).padStart(2, '0');
    $('admiralOpenCount').textContent = String(allQuestions().filter((q) => !q.reply).length).padStart(2, '0');
    if (state.adminFilter !== 'all' && !teamById(state.adminFilter)) state.adminFilter = 'all';
    $('admiralFilter').innerHTML = `<option value="all">Все команды</option>${teams().map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('')}`;
    $('admiralFilter').value = state.adminFilter;
    const engineInput = $('admiralEngineUrl');
    if (engineInput && document.activeElement !== engineInput) engineInput.value = state.engineUrl;
    const countInput = $('tourCountInput');
    if (countInput && document.activeElement !== countInput) countInput.value = state.tournament.tourCount;
    renderTourSettingsFields();
    renderAdminTourControls();
    renderAdminAssembly();
    renderStoryAdmin();
    renderAdminRoster();
    const selectedTourId = state.adminTourId || activeTour()?.id || 'tour-1';
    const feed = [...(state.tournament.status === 'finished' ? [] : demoMessages), ...state.messages]
      .filter((msg) => msg.channel !== 'global' && teamById(msg.teamId) && (msg.tourId || 'tour-1') === selectedTourId && (state.adminFilter === 'all' || state.adminFilter === msg.teamId))
      .sort((a, b) => b.at - a.at).slice(0, 18);
    $('allTeamMessages').innerHTML = feed.length ? feed.map((msg) => `<article class="feed-entry"><div class="feed-entry-head"><strong>${escapeHtml(msg.author)}</strong><span>${escapeHtml(teamById(msg.teamId)?.name || 'Команда')}</span></div><p>${richText(msg.text)}</p><button type="button" data-admin-room="${escapeHtml(msg.teamId)}" data-admin-tour="${escapeHtml(msg.tourId || 'tour-1')}">Открыть каюту · тур ${escapeHtml(String(tourById(msg.tourId || 'tour-1')?.number || 1))} ${ICON_ARROW}</button></article>`).join('') : '<p class="message-body">В выбранном туре и фильтре пока тихо.</p>';
    $('admiralQuestions').innerHTML = allQuestions().sort((a, b) => b.at - a.at).map((q) => `<article class="inbox-entry"><div class="inbox-top"><div><strong>${escapeHtml(q.author)}</strong><small>${escapeHtml(teamById(q.teamId)?.name || 'Без команды')} · ${timeMsk(q.at)} МСК</small></div><span class="inbox-status ${q.reply ? 'answered' : ''}">${q.reply ? 'ОТВЕЧЕНО' : 'ЖДЁТ ОТВЕТА'}</span></div><p>${escapeHtml(q.text)}</p>${q.reply ? `<div class="inbox-reply">Ответ: ${escapeHtml(q.reply)}</div>` : `<form class="reply-form" data-question="${escapeHtml(q.id)}"><label class="sr-only" for="reply-${escapeHtml(q.id)}">Ответ ${escapeHtml(q.author)}</label><input id="reply-${escapeHtml(q.id)}" type="text" maxlength="360" placeholder="Ответить лично…" required><button type="submit">Ответить</button></form>`}</article>`).join('');
    const modeNote = $('admiralModeNote');
    if (modeNote) modeNote.textContent = preparation
      ? `Активных режимов адмирала: ${activeAdminCount()}. Официальных команд: ${officialTeams().length} из ${MIN_TEAMS}–${MAX_TEAMS}. ${owner ? 'Ты можешь менять подготовительные данные.' : 'Режим открыт для подготовки.'}`
      : owner ? 'Право адмирала закреплено за этой сессией до завершения турнира.' : 'Просмотр админки. Изменения доступны только закреплённому адмиралу.';
    const start = $('startTournament');
    if (start) start.disabled = !preparation || !adminCanEdit() || activeAdminCount() !== 1 || officialTeams().length < MIN_TEAMS || officialTeams().length > MAX_TEAMS;
    const warning = $('adminStartWarning');
    if (warning) warning.classList.toggle('is-blocked', preparation && activeAdminCount() !== 1);
  }

  function renderNotificationPanel() {
    if (state.role === 'admiral') {
      const open = allQuestions().filter((q) => !q.reply);
      $('notificationBody').innerHTML = open.length ? open.map((q) => `<div class="notification-entry"><strong>Сигнал от ${escapeHtml(q.author)}</strong><p>${escapeHtml(q.text)}</p><button type="button" data-go="admiral">Открыть мостик →</button></div>`).join('') : '<div class="notification-empty">Новых сигналов нет. На борту спокойно.</div>';
    } else {
      const mentions = mentionsForCurrentRole();
      $('notificationBody').innerHTML = mentions.length ? mentions.map((msg) => `<div class="notification-entry"><strong>${escapeHtml(msg.author)} упоминает тебя · ${escapeHtml(teamById(msg.teamId)?.name || 'Команда')}</strong><p>${escapeHtml(msg.text)}</p><button type="button" data-read-mention="${escapeHtml(msg.id)}" data-mention-room="${escapeHtml(msg.teamId)}">Прочитать в каюте →</button></div>`).join('') : '<div class="notification-empty">Новых упоминаний пока нет. Когда тебя позовут через @, они появятся здесь при входе.</div>';
    }
  }
  function render() {
    renderHeader();
    renderStage();
    renderHome();
    if (state.view === 'room') renderRoom();
    if (state.view === 'captain') renderCaptain();
    if (state.view === 'admiral') renderAdmiral();
    renderNotificationPanel();
    lastWatchKey = state.view === 'room' ? `${state.roomId}-${Math.floor(Date.now() / PERIOD)}` : '';
  }

  function closeRoleMenu() { $('roleMenu').hidden = true; $('roleTrigger').setAttribute('aria-expanded', 'false'); }
  function closeNotifications() { $('notificationPanel').hidden = true; $('notificationTrigger').setAttribute('aria-expanded', 'false'); }
  function closeGate() {
    $('gateModal').hidden = true;
    document.body.style.overflow = '';
    gateTeamId = null;
    gatePurpose = 'member';
    $('gateInput').value = '';
    $('gateError').hidden = true;
    $('useDemoPass').hidden = false;
  }
  function openGate(teamId, purpose = 'member') {
    gatePurpose = ['captain', 'admiral'].includes(purpose) ? purpose : 'member';
    const team = teamId ? teamById(teamId) : null;
    if (gatePurpose === 'member' && !team) return;
    gateTeamId = gatePurpose === 'member' ? teamId : null;
    const demoCaptainTeam = teamById(state.captainTeamId) || teams().find((item) => captainMemberFor(item.id));
    const isAdmiralGate = gatePurpose === 'admiral';
    $('gateTitle').textContent = isAdmiralGate ? 'Войти в админку' : gatePurpose === 'captain' ? 'Подтвердить капитанский пропуск' : 'Войти в каюту';
    $('gatePassLabel').textContent = isAdmiralGate ? 'АДМИРАЛЬСКИЙ ПРОПУСК' : gatePurpose === 'captain' ? 'КАПИТАНСКИЙ ПРОПУСК' : 'ЛИЧНАЯ ССЫЛКА ОТ КАПИТАНА';
    $('gateLegal').textContent = isAdmiralGate ? 'Вставь адмиральский пропуск, сохранённый после запуска турнира.' : gatePurpose === 'captain' ? 'Введи пропуск капитана любой утверждённой команды. Команда определится по пропуску.' : 'Введи личный пропуск выбранной команды.';
    $('useDemoPass').hidden = isAdmiralGate;
    $('useDemoPass').textContent = gatePurpose === 'captain' ? `Вставить демо-пропуск капитана «${demoCaptainTeam?.name || 'первой команды'}»` : 'Вставить демо-пропуск для этой команды';
    $('gateTeamName').textContent = isAdmiralGate ? 'Текущий турнир · адмиральский доступ' : gatePurpose === 'captain' ? 'Любая утверждённая команда · команда определится по пропуску' : `Команда «${team.name}» · ${team.members.length} на борту`;
    $('gateInput').value = '';
    $('gateError').hidden = true;
    $('gateModal').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('gateInput').focus(), 40);
  }
  function openRoom(teamId, tourId = null) {
    const team = teamById(teamId);
    if (!team) return;
    if (state.tournament.status === 'active' && state.role !== 'admiral' && !participantTour()) {
      toast('Адмирал ещё не открыл текущий тур.');
      return;
    }
    const captainOwns = state.role === 'captain' && teamId === state.captainTeamId && hasCaptainAccess(teamId);
    if (state.role === 'admiral' || captainOwns || state.joined[teamId]) {
      if (state.role === 'matros') { state.matrosTeamId = teamId; }
      state.roomTourId = state.role === 'admiral' ? (tourId || state.adminTourId || activeTour()?.id || 'tour-1') : (participantTour()?.id || 'tour-1');
      save();
      setView('room', teamId);
      renderRoom();
      if (pendingTag && pendingTag.teamId === teamId) { insertTag(pendingTag.name, true); pendingTag = null; }
    } else openGate(teamId);
  }
  function parsePass(raw) {
    const text = raw.trim();
    const match = text.match(/\/j\/([^/?#\s]+)/i);
    try { return decodeURIComponent(match ? match[1] : text).trim(); } catch (_) { return match ? match[1] : text; }
  }
  function passHolder(token) {
    for (const team of teams()) for (const member of team.members) if (member.token === token) return { team, member };
    return null;
  }
  function gateError(text) { $('gateError').textContent = text; $('gateError').hidden = false; }

  function mentionSuggestions(query = '') {
    const team = teamById(state.roomId);
    const matches = team?.members.filter((member) => member.name.toLowerCase().startsWith(query.toLowerCase())) || [];
    const menu = $('mentionMenu');
    menu.innerHTML = matches.map((member) => `<button type="button" data-insert-mention="${escapeHtml(member.name)}"><span>@</span>${escapeHtml(member.name)}</button>`).join('');
    menu.hidden = matches.length === 0;
  }
  function insertTag(name, addNudge = false) {
    const textarea = $('teamChatText');
    const at = textarea.selectionStart || textarea.value.length;
    const before = textarea.value.slice(0, at);
    const after = textarea.value.slice(at);
    const match = before.match(/@[А-Яа-яЁёA-Za-z0-9_-]*$/);
    const prefix = match ? before.slice(0, -match[0].length) : before + (before && !/\s$/.test(before) ? ' ' : '');
    textarea.value = `${prefix}@${name}${addNudge ? ', твоя вахта — загляни в график, пожалуйста.' : ' '}${after}`;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    $('mentionMenu').hidden = true;
    scrollToId('roomChatSection');
  }
  function callCurrentWatch() {
    const team = teamById(state.matrosTeamId) || teams()[0];
    if (!team) { toast('Сначала адмирал должен создать хотя бы одну команду.'); return; }
    if (state.role === 'admiral') { openRoom(team.id); scrollToId('roomScheduleSection'); return; }
    const name = watchAt(team).member.name;
    pendingTag = { teamId: team.id, name };
    openRoom(team.id);
    if (state.view === 'room' && state.roomId === team.id && pendingTag) { insertTag(name, true); pendingTag = null; }
  }

  async function copyAdminRecoveryCode() {
    const code = state.tournament.adminRecoveryCode;
    if (!code) { toast('Код появится после запуска турнира.'); return; }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(code);
      toast('Адмиральский пропуск скопирован.');
    } catch (_) {
      const tmp = document.createElement('textarea');
      tmp.value = code; tmp.style.position = 'fixed'; tmp.style.opacity = '0'; document.body.appendChild(tmp); tmp.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { /* sandboxed clipboard */ }
      tmp.remove();
      toast(copied ? 'Адмиральский пропуск скопирован.' : 'Скопируй адмиральский пропуск вручную.');
    }
  }
  async function copyPass(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast('Демо-пропуск скопирован.');
    } catch (_) {
      const tmp = document.createElement('textarea');
      tmp.value = text; tmp.style.position = 'fixed'; tmp.style.opacity = '0'; document.body.appendChild(tmp); tmp.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { /* sandboxed clipboard */ }
      tmp.remove();
      toast(copied ? 'Демо-пропуск скопирован.' : 'Скопируй код пропуска вручную из списка.');
    }
  }

  // Navigation and small actions use event delegation because chat and lists re-render.
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest('#saveTournamentSettings')) { saveTournamentSettings(); return; }
    if (target.closest('#startTournament')) { startTournament(); return; }
    if (target.closest('#openSelectedTour')) { openSelectedTour(); return; }
    if (target.closest('#saveActiveTourDeadline')) { saveActiveTourDeadline(); return; }
    if (target.closest('#emergencyFinishTour')) { emergencyFinishTour(); return; }
    if (target.closest('#copyAdminRecoveryCode')) { copyAdminRecoveryCode(); return; }
    if (target.closest('#demoTestMatros')) {
      const teamId = $('demoTestTeam')?.value || teams()[0]?.id;
      if (!teamId) { toast('Сначала адмирал должен создать команду.'); return; }
      const team = teamById(teamId);
      if (!team?.members.some((member) => member.role !== 'captain')) { toast('Сначала заполни хотя бы один матросский слот.'); return; }
      openGate(teamId, 'member');
      return;
    }
    if (target.closest('#demoTestCaptain')) {
      if (!teams().length) { toast('Сначала адмирал должен создать команду.'); return; }
      openGate(null, 'captain');
      return;
    }
    if (target.closest('#finishTournament')) { finishTournament(); return; }
    const transferAdminButton = target.closest('[data-transfer-admin]');
    if (transferAdminButton) { transferAdmin(transferAdminButton.dataset.transferAdmin); return; }
    if (target.closest('#leaveAdmiralMode')) { setRole('matros'); return; }
    const adminCaptainPass = target.closest('[data-admin-issue-captain-pass]');
    if (adminCaptainPass) { issueCaptainPass(adminCaptainPass.dataset.adminIssueCaptainPass); return; }
    const adminPromote = target.closest('[data-admin-promote]');
    if (adminPromote) { adminChangeMember('promote', adminPromote.dataset.adminPromote); return; }
    const adminDemote = target.closest('[data-admin-demote]');
    if (adminDemote) { adminChangeMember('demote', adminDemote.dataset.adminDemote); return; }
    const adminClear = target.closest('[data-admin-clear]');
    if (adminClear) { adminChangeMember('clear', adminClear.dataset.adminClear); return; }
    const adminDismiss = target.closest('[data-admin-dismiss]');
    if (adminDismiss) { adminChangeMember('dismiss', adminDismiss.dataset.adminDismiss); return; }
    const captainClear = target.closest('[data-captain-clear]');
    if (captainClear) { captainClearSailor(captainClear.dataset.captainClear); return; }
    const captainPropose = target.closest('[data-captain-propose]');
    if (captainPropose) { proposeCandidate(captainPropose.dataset.captainPropose); return; }
    const captainInvite = target.closest('[data-captain-invite]');
    if (captainInvite) { inviteApprovedCandidate(captainInvite.dataset.captainInvite); return; }
    const adminApprove = target.closest('[data-admin-approve-proposal]');
    if (adminApprove) { approveCandidateProposal(adminApprove.dataset.adminApproveProposal); return; }
    const storyLike = target.closest('[data-like-discussion]');
    if (storyLike) { toggleStoryLike(storyLike.dataset.likeDiscussion); return; }
    const storyDelete = target.closest('[data-delete-discussion]');
    if (storyDelete) {
      if (!adminCanEdit()) { toast('Только адмирал может модерировать обсуждения.'); return; }
      state.messages = state.messages.filter((message) => message.id !== storyDelete.dataset.deleteDiscussion);
      save(); render(); toast('Сообщение удалено из обсуждения.'); return;
    }
    const storyCardDelete = target.closest('[data-delete-story-card]');
    if (storyCardDelete) { deleteStoryCard(storyCardDelete.dataset.deleteStoryCard); return; }
    const storyCardButton = target.closest('[data-story-card]');
    if (storyCardButton) {
      const choice = $('storyCardChoice');
      if (choice) { choice.value = storyCardButton.dataset.storyCard; choice.focus(); scrollToId('storyDiscussionForm'); }
      return;
    }
    const juniorRoleChoice = target.closest('[data-junior-role-choice]');
    if (juniorRoleChoice) {
      const input = $('juniorDesiredRole');
      if (input) input.value = juniorRoleChoice.dataset.juniorRoleChoice === 'captain' ? 'captain' : 'member';
      document.querySelectorAll('[data-junior-role-choice]').forEach((button) => button.classList.toggle('is-selected', button === juniorRoleChoice));
      return;
    }
    if (target.closest('[data-join-bench]')) { joinReserveBench(); return; }
    const go = target.closest('[data-go]');
    if (go) { navigate(go.dataset.go); return; }
    const stage = target.closest('[data-stage]');
    if (stage) {
      state.stage = stage.dataset.stage;
      renderStage(); renderHome();
      if (state.view === 'room') renderRoom();
      save();
      if (stage.closest('.locked-chat')) scrollToId('loungeSection');
      return;
    }
    const role = target.closest('[data-role]');
    if (role) { setRole(role.dataset.role); return; }
    const room = target.closest('[data-open-room]');
    if (room) { pendingTag = null; openRoom(room.dataset.openRoom); return; }
    const adminRoom = target.closest('[data-admin-room]');
    if (adminRoom) { openRoom(adminRoom.dataset.adminRoom, adminRoom.dataset.adminTour); return; }
    const tag = target.closest('[data-tag-name]');
    if (tag) { insertTag(tag.dataset.tagName); return; }
    const mention = target.closest('[data-insert-mention]');
    if (mention) { insertTag(mention.dataset.insertMention); return; }
    const deleteMessage = target.closest('[data-delete-message]');
    if (deleteMessage) {
      if (state.role !== 'admiral' || !adminCanEdit()) { toast('Только адмирал с правом редактирования может модерировать ленту.'); return; }
      state.messages = state.messages.filter((message) => message.id !== deleteMessage.dataset.deleteMessage);
      save(); render(); toast('Сообщение удалено из Кают-компании.'); return;
    }
    if (target.closest('#saveEngineUrl')) { saveEngineUrl(); return; }
    if (target.closest('#saveCaptainAvatar')) { saveTeamAvatarUrl(); return; }
    const removeAvatar = target.closest('[data-remove-avatar]');
    if (removeAvatar) { removeTeamAvatar(removeAvatar.dataset.removeAvatar); return; }
    const copy = target.closest('[data-copy]');
    if (copy) { copyPass(copy.dataset.copy); return; }
    const readMention = target.closest('[data-read-mention]');
    if (readMention) {
      const id = readMention.dataset.readMention;
      if (id === 't1') state.notificationRead = true;
      state.readMentionIds.push(id);
      save(); closeNotifications(); renderHeader(); renderNotificationPanel(); openRoom(readMention.dataset.mentionRoom);
      if (state.view === 'room') scrollToId('roomChatSection');
      return;
    }
    if (target.closest('#notificationTrigger')) {
      const open = $('notificationPanel').hidden;
      closeRoleMenu(); renderNotificationPanel(); $('notificationPanel').hidden = !open;
      $('notificationTrigger').setAttribute('aria-expanded', String(open)); return;
    }
    if (target.closest('#roleTrigger')) {
      const open = $('roleMenu').hidden;
      closeNotifications(); $('roleMenu').hidden = !open;
      $('roleTrigger').setAttribute('aria-expanded', String(open)); return;
    }
    if (target.closest('#closeNotifications')) { closeNotifications(); return; }
    if (target.closest('#closeGate')) { closeGate(); pendingTag = null; return; }
    if (target === $('gateModal')) { closeGate(); pendingTag = null; return; }
    if (target.closest('#useDemoPass')) {
      const team = gatePurpose === 'captain' ? (teamById(state.captainTeamId) || teams().find((item) => captainMemberFor(item.id))) : teamById(gateTeamId);
      if (!team) return;
      const demoMember = gatePurpose === 'captain' ? team.members.find((member) => member.role === 'captain') : team.members.find((member) => member.name === team.demoName) || team.members[1] || team.members[0];
      $('gateInput').value = demoMember?.token || '';
      $('gateInput').focus(); $('gateError').hidden = true; return;
    }
    if (target.closest('#callWatch')) { callCurrentWatch(); return; }
    if (target.closest('#mentionButton')) {
      if ($('mentionMenu').hidden) mentionSuggestions(''); else $('mentionMenu').hidden = true;
      $('teamChatText').focus(); return;
    }
    if (target.closest('#saveCaptainSchedule')) { saveCaptainSchedule(); return; }
    if (target.closest('#openCaptainRoom')) { openRoom(state.captainTeamId); return; }
    if (target.closest('#resetDemo')) {
      leaveAdminPresence();
      sessionRole = 'matros';
      try { sessionStorage.setItem('kolfan-role', sessionRole); } catch (_) { /* sessionStorage can be unavailable */ }
      state = freshState();
      try { localStorage.removeItem(storageKey); } catch (_) { /* preview sandbox */ }
      closeRoleMenu(); closeNotifications(); closeGate(); pendingTag = null;
      setView('home'); render(); toast('Макет сброшен. Снова добро пожаловать на борт!'); return;
    }
    if (!target.closest('#roleMenu')) closeRoleMenu();
    if (!target.closest('#notificationPanel')) closeNotifications();
    if (!target.closest('#mentionMenu') && !target.closest('#teamChatText')) $('mentionMenu').hidden = true;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('gateModal').hidden) { closeGate(); pendingTag = null; }
      else { closeRoleMenu(); closeNotifications(); $('mentionMenu').hidden = true; }
    }
  });

  $('teamChatText').addEventListener('input', () => {
    const el = $('teamChatText');
    const match = el.value.slice(0, el.selectionStart).match(/(?:^|\s)@([А-Яа-яЁёA-Za-z0-9_-]*)$/);
    if (match) mentionSuggestions(match[1]); else $('mentionMenu').hidden = true;
  });
  $('captainTeamSelect').addEventListener('change', (event) => { state.captainTeamId = event.target.value; renderCaptain(); save(); });
  $('admiralFilter').addEventListener('change', (event) => { state.adminFilter = event.target.value; renderAdmiral(); save(); });
  $('admiralTourFilter')?.addEventListener('change', (event) => { state.adminTourId = event.target.value; renderAdmiral(); save(); });
  $('admiralTeamSelect')?.addEventListener('change', (event) => { state.adminTeamId = event.target.value; renderAdminRoster(); save(); });
  $('demoTestTeam')?.addEventListener('change', () => { renderLiveAdminTools(); });
  $('tourCountInput')?.addEventListener('change', () => { renderTourSettingsFields(); });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form.id === 'gateForm') {
      event.preventDefault();
      if (gatePurpose === 'admiral') {
        const entered = normalizeRecoveryCode($('gateInput').value);
        const expected = normalizeRecoveryCode(state.tournament.adminRecoveryCode);
        if (state.tournament.status !== 'active' || !expected || entered !== expected) {
          gateError('Адмиральский пропуск не подошёл для текущего турнира.');
          return;
        }
        state.tournament.adminOwnerSessionId = adminSessionId;
        state.role = 'admiral';
        sessionRole = 'admiral';
        try { sessionStorage.setItem('kolfan-role', sessionRole); } catch (_) { /* continue without session storage */ }
        closeGate();
        refreshAdminPresence();
        save();
        setView('admiral');
        render();
        toast('Адмиральское право восстановлено по пропуску.');
        return;
      }
      const holder = passHolder(parsePass($('gateInput').value));
      if (!holder) { gateError('Пропуск не найден. Попроси капитана прислать тебе личную ссылку.'); return; }
      if (gatePurpose !== 'captain' && holder.team.id !== gateTeamId) { gateError('Этот пропуск от другой команды. Для выбранной каюты нужна её личная ссылка.'); return; }
      if (gatePurpose === 'captain' && holder.member.role !== 'captain') { gateError('Для капитанского мостика нужен пропуск назначенного капитана.'); return; }
      const captainBridgeRequested = gatePurpose === 'captain';
      state.joined[holder.team.id] = holder.member.name;
      sessionDisplayName = holder.member.name;
      const id = holder.team.id;
      const nextRole = holder.member.role === 'captain' ? 'captain' : 'matros';
      state.role = nextRole;
      sessionRole = nextRole;
      if (nextRole === 'captain') state.captainTeamId = id;
      else state.matrosTeamId = id;
      try {
        sessionStorage.setItem('kolfan-display-name', sessionDisplayName);
        sessionStorage.setItem('kolfan-role', sessionRole);
      } catch (_) { /* continue without session storage */ }
      save();
      closeGate();
      if (captainBridgeRequested) {
        setView('captain');
        render();
      } else {
        openRoom(id);
        renderHeader();
      }
      toast(`Пропуск принят. Добро пожаловать в «${holder.team.name}»!`);
      return;
    }
    if (form.id === 'teamChatForm') {
      event.preventDefault();
      const tour = roomTour();
      if (state.role === 'admiral') { toast('Адмирал только читает чаты кают.'); return; }
      if (tourIsEnded(tour)) { toast('Дедлайн прошёл: завершённый чат доступен только для чтения.'); return; }
      const text = $('teamChatText').value.trim();
      const teamId = state.roomId;
      const actor = actorForTeam(teamId);
      if (!text || !actor) { toast('Чтобы писать, войди по личному пропуску команды.'); return; }
      state.messages.push({ id: 'm' + Date.now(), channel: teamId, tourId: tour?.id || 'tour-1', author: actor, teamId, text: text.slice(0, 500), at: Date.now() });
      $('teamChatText').value = ''; $('mentionMenu').hidden = true; save(); renderRoom(); renderHeader(); renderNotificationPanel();
      toast(/@[А-Яа-яЁёA-Za-z]/.test(text) ? 'Сообщение с @упоминанием появилось в чате каюты.' : 'Сообщение оставлено в чате каюты.');
      return;
    }
    if (form.id === 'generalChatForm') {
      event.preventDefault();
      if (state.tournament.status === 'finished') return;
      const input = $('generalChatText');
      const text = input.value.trim();
      if (!text) return;
      let actor = globalIdentity();
      if (actor.actorType === 'junior') {
        const name = ($('juniorNameInput')?.value || '').trim();
        if (!name) { toast('Укажи ник: он будет виден рядом с сообщением.'); $('juniorNameInput')?.focus(); return; }
        sessionDisplayName = name.slice(0, 26);
        try { sessionStorage.setItem('kolfan-display-name', sessionDisplayName); } catch (_) { /* continue without session storage */ }
        actor = globalIdentity();
      }
      state.messages.push({ id: 'g' + Date.now(), channel: 'global', author: actor.author, actorType: actor.actorType, sessionId: actor.sessionId || null, teamId: actor.teamId, text: text.slice(0, 500), at: Date.now() });
      save(); renderGeneral(); renderHeader(); toast('Сообщение появилось в Кают-компании.'); return;
    }
    if (form.id === 'storyDiscussionForm') {
      event.preventDefault();
      const tour = participantTour();
      const actor = globalIdentity();
      const card = storyCardById($('storyCardChoice')?.value);
      const text = $('storyDiscussionText')?.value.trim();
      if (!tour || tourIsEnded(tour) || actor.actorType === 'junior' || !actor.teamId || (actor.actorType === 'captain' ? !hasCaptainAccess(actor.teamId) : !state.joined[actor.teamId])) { toast('Обсуждение доступно участникам текущего тура по командному пропуску.'); return; }
      if (!card || card.tourId !== tour.id || !text) return;
      state.messages.push({ id: randomId('discussion'), channel: 'story-discussion', tourId: tour.id, storyCardId: card.id, storyTitle: card.title, storyTopic: card.topic, storyTeamId: card.teamId, author: actor.author, actorType: actor.actorType, teamId: actor.teamId, text: text.slice(0, 700), at: Date.now() });
      save();
      renderStoryDiscussion();
      toast('Впечатление добавлено в обсуждение.');
      return;
    }
    if (form.id === 'storyCardForm') {
      event.preventDefault();
      addStoryCard();
      return;
    }
    if (form.id === 'urgentForm') {
      event.preventDefault();
      const text = $('urgentText').value.trim();
      if (!text) return;
      if (state.role === 'admiral') { toast('Адмирал уже на мостике — отвечай в списке сигналов.'); return; }
      const actor = globalIdentity();
      if (actor.actorType !== 'junior' && !state.joined[actor.teamId] && state.role !== 'captain') { toast('Сначала войди по личному пропуску команды.'); return; }
      state.questions.push({ id: 'q' + Date.now(), author: actor.author, teamId: actor.teamId, actorType: actor.actorType, text: text.slice(0, 360), at: Date.now(), reply: '' });
      $('urgentText').value = ''; save(); renderMyQuestions(); toast('Сигнал создан. В демо он виден на адмиральском мостике.'); return;
    }
    if (form.id === 'adminIdentityForm') {
      event.preventDefault();
      saveAdminName();
      return;
    }
    if (form.id === 'tournamentSettingsForm') {
      event.preventDefault();
      saveTournamentSettings();
      return;
    }
    if (form.id === 'adminAssignBenchForm') {
      event.preventDefault();
      assignCandidateToTeam();
      return;
    }
    if (form.id === 'adminCreateTeamForm') {
      event.preventDefault();
      createTeamFromBench();
      return;
    }
    if (form.matches('.reply-form')) {
      event.preventDefault();
      if (state.role !== 'admiral') return;
      const questionId = form.dataset.question;
      const reply = form.querySelector('input').value.trim();
      if (!reply || !allQuestions().some((q) => q.id === questionId)) return;
      state.replies[questionId] = reply.slice(0, 360); save(); renderAdmiral(); renderHeader(); renderNotificationPanel(); toast('Ответ оставлен адресату (в этом браузере).');
    }
  });

  // Render once, then update the real clock and current shift without reloading the page.
  setView(state.role === 'admiral' ? 'admiral' : state.role === 'captain' ? 'captain' : 'home');
  render();
  setInterval(renderWatch, 1000);
})();
