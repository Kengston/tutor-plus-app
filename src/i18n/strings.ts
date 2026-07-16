/**
 * Centralised UI dictionary (RU). The ONLY place literal UI strings live —
 * components must not inline strings (ADR-0003 forward-compatibility contract).
 *
 * Keys use the i18next `context` form:
 *   - `<key>`          → base value (tutor / mode-neutral)
 *   - `<key>_client`   → override for client mode (optional; falls back to base)
 *
 * Binary axis today (ADR-0006); the same mechanism extends to per-activity
 * lexicon later (`<key>_psychologist`, …) with no call-site changes.
 *
 * RU plural forms live as `*.one|few|many` keys, composed via `plural()`.
 */

export const messages = {
  // ── Navigation (mode-neutral except "students") ──────────────────────────
  'nav.today': 'Сегодня',
  'nav.schedule': 'Расписание',
  'nav.students': 'Ученики',
  'nav.students_client': 'Клиенты',
  'nav.finance': 'Финансы',
  'nav.analytics': 'Аналитика',

  // ── Common ───────────────────────────────────────────────────────────────
  'common.add': 'Добавить',
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.back': 'Назад',
  'common.contact': 'Связаться',
  'common.search': 'Поиск',
  'common.filter': 'Фильтр',
  'common.all': 'Все',
  'common.soon': 'Скоро здесь',

  // ── Today ────────────────────────────────────────────────────────────────
  'today.greeting': 'Добрый день',
  'today.nearest': 'Ближайший урок',
  'today.nearest_client': 'Ближайшая встреча',
  'today.empty': 'На сегодня уроков нет',
  'today.empty_client': 'На сегодня встреч нет',
  // «Ваш день» card (spec 04, prototype TodayScreen)
  'today.yourDay': 'Ваш день',
  'today.conducted': 'проведено',
  'today.ahead': 'впереди',
  'today.nextAt': 'следующее в',
  // Debt badge in «Далее сегодня» rows (spec 04; prototype TLRow «Есть долг»)
  'today.debtBadge': 'Есть долг',

  // ── Full weekday names (genitive-free, lowercase — «вторник, 26 мая») ────
  'wdFull.0': 'воскресенье',
  'wdFull.1': 'понедельник',
  'wdFull.2': 'вторник',
  'wdFull.3': 'среда',
  'wdFull.4': 'четверг',
  'wdFull.5': 'пятница',
  'wdFull.6': 'суббота',

  // ── Schedule ─────────────────────────────────────────────────────────────
  // Screen header is FIXED «Расписание» in both modes (spec 05 preamble);
  // the mode-pair `schedule.title` is legacy, kept for reference only.
  'schedule.header': 'Расписание',
  'schedule.title': 'Расписание уроков',
  'schedule.title_client': 'Расписание встреч',
  'schedule.empty': 'Здесь появится расписание',
  // Day block under the calendar grid (spec 05 preamble: `scheduleDay`).
  'schedule.day': 'Расписание дня',
  'schedule.day_client': 'Расписание встреч',
  // Day summary (spec 05 §5.1; prototype DayGlance)
  'schedule.conducted': 'проведено',
  'schedule.nextAt': 'следующее в',
  'schedule.dayOver': 'день завершён',
  'schedule.today': 'Сегодня',
  'schedule.pickMonth': 'Месяц и год',
  'schedule.legend': 'Цвета учеников',
  'schedule.legend_client': 'Цвета клиентов',

  // ── Students / Clients ───────────────────────────────────────────────────
  'students.title': 'Ученики',
  'students.title_client': 'Клиенты',
  'students.new': 'Новый ученик',
  'students.new_client': 'Новый клиент',
  'students.empty': 'Пока нет учеников',
  'students.empty_client': 'Пока нет клиентов',

  // ── Finance ──────────────────────────────────────────────────────────────
  'finance.title': 'Финансы',
  'finance.received': 'Получено',
  'finance.debt': 'Долг',
  'finance.empty': 'Операций пока нет',

  // ── Analytics ────────────────────────────────────────────────────────────
  'analytics.title': 'Аналитика',
  'analytics.overview': 'Обзор',
  'analytics.dynamics': 'Динамика',
  'analytics.debts': 'Задолженности',
  'analytics.empty': 'Недостаточно данных',

  // ── Lesson / Meeting ─────────────────────────────────────────────────────
  'lesson.nom': 'Урок',
  'lesson.nom_client': 'Встреча',
  'lesson.create': 'Создать урок',
  'lesson.create_client': 'Создать встречу',
  'lesson.markDone': 'Отметить проведённым',
  'lesson.markDone_client': 'Отметить проведённой',
  'lesson.cost': 'Стоимость',
  'lesson.subject': 'Предмет',
  'lesson.subject_client': 'Направление / тема',
  'lesson.rate': 'Ставка за урок',
  'lesson.rate_client': 'Ставка за встречу',

  // ── Auth ─────────────────────────────────────────────────────────────────
  'auth.title': 'Tutor+',
  'auth.subtitle': 'Расписание, ученики, финансы — в одном месте',
  'auth.subtitle_client': 'Расписание, клиенты, финансы — в одном месте',
  'auth.signIn': 'Войти',
  'auth.createAccount': 'Создать аккаунт',
  'auth.withApple': 'Продолжить с Apple',
  'auth.withGoogle': 'Продолжить с Google',
  'auth.email': 'Эл. почта',
  'auth.phone': 'Телефон',
  'auth.signOut': 'Выйти',
  'auth.or': 'или',

  // ── Profile / Settings ───────────────────────────────────────────────────
  'profile.title': 'Профиль',
  'settings.title': 'Настройки',
  'settings.appearance': 'Оформление',
  'settings.theme': 'Тема',

  // ── Dev toggles (Phase-0 scaffold header) ────────────────────────────────
  'dev.theme': 'Тема',
  'dev.mode': 'Режим',
  'dev.themeSystem': 'Авто',
  'dev.themeLight': 'День',
  'dev.themeDark': 'Вечер',

  // ── Plural units ─────────────────────────────────────────────────────────
  'unit.students.one': 'ученик',
  'unit.students.few': 'ученика',
  'unit.students.many': 'учеников',
  'unit.students.one_client': 'клиент',
  'unit.students.few_client': 'клиента',
  'unit.students.many_client': 'клиентов',
  'unit.lessons.one': 'урок',
  'unit.lessons.few': 'урока',
  'unit.lessons.many': 'уроков',
  'unit.lessons.one_client': 'встреча',
  'unit.lessons.few_client': 'встречи',
  'unit.lessons.many_client': 'встреч',
  'unit.minutes.one': 'минуту',
  'unit.minutes.few': 'минуты',
  'unit.minutes.many': 'минут',
  'unit.hours.one': 'час',
  'unit.hours.few': 'часа',
  'unit.hours.many': 'часов',
  'unit.days.one': 'день',
  'unit.days.few': 'дня',
  'unit.days.many': 'дней',
  'unit.directions.one': 'направление',
  'unit.directions.few': 'направления',
  'unit.directions.many': 'направлений',

  // ── Phase 1 · common actions & units ─────────────────────────────────────
  'common.edit': 'Изменить',
  'common.delete': 'Удалить',
  'common.done': 'Готово',
  'common.copied': 'Скопировано',
  'common.of': 'из',
  'common.none': '—',
  'common.tomorrow': 'Завтра',
  'common.min': 'мин',
  'common.hour': 'ч',
  'common.online': 'Онлайн',
  'common.inperson': 'Очно',

  // ── Lesson format ────────────────────────────────────────────────────────
  'format.online': 'Онлайн',
  'format.inperson': 'Очно',

  // ── Student status (display) ─────────────────────────────────────────────
  'status.active': 'Активный',
  'status.paused': 'Пауза',
  'status.archived': 'Архив',

  // ── Students: filter / sort / search ─────────────────────────────────────
  'filter.all': 'Все',
  'filter.active': 'Активные',
  'filter.paused': 'Пауза',
  'filter.archived': 'Архив',
  'filter.debtors': 'Есть долг',
  'filter.hasLessons': 'Есть занятия',
  'filter.hasLessons_client': 'Есть встречи',
  'sort.label': 'Сортировка',
  'sort.name': 'Имя',
  'sort.added': 'Дата добавления',
  'sort.status': 'Статус',
  'sort.debt': 'Долг',
  'students.search': 'Поиск по ученикам',
  'students.search_client': 'Поиск по клиентам',
  'students.archive': 'Архивировать',
  'students.emptyFiltered': 'Никого не найдено',

  // ── Students list (spec 06 §6.1–6.2, UI-v2 S8) ────────────────────────────
  'students.found': 'Найдено',                       // «Найдено: N»
  'students.nextLesson': 'следующее',                 // «следующее сегодня, 16:00»
  'students.today': 'сегодня',
  'students.tomorrow': 'завтра',
  'students.emptyTitle': 'Пока нет учеников',
  'students.emptyTitle_client': 'Пока нет клиентов',
  'students.emptyBody': 'Добавьте первого ученика — расписание, оплаты и заметки будут собраны здесь',
  'students.emptyBody_client': 'Добавьте первого клиента — расписание, оплаты и заметки будут собраны здесь',
  'students.addFirst': 'Добавить ученика',
  'students.addFirst_client': 'Добавить клиента',
  'students.emptyFilters': 'По выбранным фильтрам никого нет. Измените параметры или сбросьте фильтры',
  'students.searchEmpty': 'Ничего не найдено',
  'students.searchEmptyBy': 'По запросу',            // «По запросу «…» нет учеников»
  'students.searchEmptyNo': 'нет учеников',          // dual-mode tail of the search-empty body
  'students.searchEmptyNo_client': 'нет клиентов',
  'students.clearSearch': 'Очистить поиск',

  // ── Payment tri-state (display) ──────────────────────────────────────────
  'pay.paid': 'Оплачено',
  'pay.debt': 'Долг',
  'pay.expected': 'Ожидается',

  // ── Contact actions ──────────────────────────────────────────────────────
  'contact.call': 'Позвонить',
  'contact.message': 'Написать',
  'contact.copy': 'Копировать номер',

  // ── Entity field labels (card + form) ────────────────────────────────────
  'field.name': 'Имя',
  'field.category': 'Цвет',
  'field.status': 'Статус',
  'field.subjects': 'Предметы',
  'field.subjects_client': 'Направления',
  'field.format': 'Формат',
  'field.rate': 'Ставка',
  'field.schedule': 'Расписание',
  'field.phone': 'Телефон',
  'field.topic': 'Тема',
  'field.date': 'Дата',
  'field.time': 'Время',
  'field.duration': 'Длительность',
  'field.cost': 'Стоимость',
  'field.comment': 'Комментарий',
  'field.student': 'Ученик',
  'field.student_client': 'Клиент',

  // ── Student card ─────────────────────────────────────────────────────────
  'student.upcoming': 'Ближайшие занятия',
  'student.upcoming_client': 'Ближайшие встречи',
  'student.scheduleLesson': 'Занятие',
  'student.scheduleLesson_client': 'Встреча',
  'student.archived': 'В архиве',
  'student.noUpcoming': 'Нет предстоящих занятий',
  'student.noUpcoming_client': 'Нет предстоящих встреч',

  // ── Student profile (spec 06 §6.3, UI-v2 S9) ──────────────────────────────
  'profile.next': 'Следующее занятие',
  'profile.next_client': 'Следующая встреча',
  'profile.openLesson': 'Открыть занятие',
  'profile.openLesson_client': 'Открыть встречу',
  'profile.about': 'Об обучении',
  'profile.payments': 'Оплаты',
  'profile.noDebt': 'Без задолженности',
  'profile.notes': 'Заметки',
  'profile.addNote': 'Добавить заметку',
  'profile.notesEmpty': 'Пока нет заметок',
  'profile.history': 'История занятий',
  'profile.history_client': 'История встреч',
  'profile.historyEmpty': 'Проведённых занятий пока нет',
  'profile.historyEmpty_client': 'Проведённых встреч пока нет',
  'profile.deleteNote': 'Удалить заметку',
  // Status management (spec 06 §6.3: пауза/архив с подтверждением)
  'profile.pause': 'Поставить на паузу',
  'profile.activate': 'Активировать',
  'profile.confirmPause': 'Приостановить занятия с этим учеником?',
  'profile.confirmPause_client': 'Приостановить встречи с этим клиентом?',
  'profile.confirmActivate': 'Вернуть ученика к активным?',
  'profile.confirmActivate_client': 'Вернуть клиента к активным?',
  'profile.confirmArchive': 'Убрать ученика в архив?',
  'profile.confirmArchive_client': 'Убрать клиента в архив?',
  'profile.confirm': 'Подтвердить',

  // ── Student form ─────────────────────────────────────────────────────────
  'form.editTitle': 'Редактирование',
  'form.namePlaceholder': 'Имя ученика',
  'form.namePlaceholder_client': 'Имя клиента',
  'form.schedulePlaceholder': 'Напр. Пн, Ср · 16:00',

  // ── Schedule slots editor (ADR-0016, UI-v2 S6) ────────────────────────────
  'slots.title': 'Расписание',
  'slots.empty': 'Регулярных занятий пока нет',
  'slots.empty_client': 'Регулярных встреч пока нет',
  'slots.add': 'Добавить слот',
  'slots.edit': 'Изменить слот',
  'slots.weekday': 'День недели',
  'slots.time': 'Время',
  'slots.close': 'Закрыть слот',
  'slots.manage': 'Настроить расписание',
  'form.subjectsHint': 'Выберите предметы',
  'form.subjectsHint_client': 'Выберите направления',
  'form.addSubject': 'Добавить предмет',
  'form.addSubject_client': 'Добавить направление',

  // ── Lesson lifecycle (display; gendered _client) ─────────────────────────
  'life.upcoming': 'Предстоит',
  'life.ongoing': 'Сейчас',
  'life.done': 'Проведено',
  'life.done_client': 'Проведена',
  'life.cancelled': 'Отменено',
  'life.cancelled_client': 'Отменена',

  // ── Lesson actions (swipe / card) ────────────────────────────────────────
  'action.conduct': 'Провести',
  'action.reschedule': 'Перенести',
  'action.cancel': 'Отменить',
  'action.undo': 'Вернуть',

  // ── Series scope sheet (ADR-0016, UI-v2 S7; prototype ScopeSheet) ─────────
  'scope.cancelTitle': 'Что отменить',
  'scope.editTitle': 'Применить изменения',
  'scope.cancel.one': 'Только это занятие',
  'scope.cancel.one_client': 'Только эту встречу',
  'scope.cancel.oneSub': 'Остальные занятия серии останутся в расписании.',
  'scope.cancel.oneSub_client': 'Остальные встречи серии останутся в расписании.',
  'scope.cancel.following': 'Это и следующие',
  'scope.cancel.followingSub': 'Отменятся это и все будущие занятия серии.',
  'scope.cancel.followingSub_client': 'Отменятся это и все будущие встречи серии.',
  'scope.cancel.all': 'Всю серию',
  'scope.cancel.allSub': 'Регулярные занятия будут отменены полностью.',
  'scope.cancel.allSub_client': 'Регулярные встречи будут отменены полностью.',
  'scope.edit.one': 'Только к этому занятию',
  'scope.edit.one_client': 'Только к этой встрече',
  'scope.edit.oneSub': 'Остальные занятия серии не изменятся.',
  'scope.edit.oneSub_client': 'Остальные встречи серии не изменятся.',
  'scope.edit.following': 'К этому и следующим',
  'scope.edit.followingSub': 'Изменятся это и все будущие занятия серии.',
  'scope.edit.followingSub_client': 'Изменятся это и все будущие встречи серии.',
  'scope.edit.all': 'Ко всей серии',
  'scope.edit.allSub': 'Изменятся все регулярные занятия серии.',
  'scope.edit.allSub_client': 'Изменятся все регулярные встречи серии.',
  // Cancel-reason prompt
  'cancel.reasonTitle': 'Причина отмены',
  'cancel.reasonPlaceholder': 'Необязательно',
  'cancel.confirm': 'Отменить занятие',
  'cancel.confirm_client': 'Отменить встречу',

  // ── Snackbar confirmations (spec 00 §подтверждения, 04-today) ────────────
  'snack.lessonDone': 'Урок проведён',
  'snack.lessonDone_client': 'Встреча проведена',
  'snack.lessonCancelled': 'Урок отменён',
  'snack.lessonCancelled_client': 'Встреча отменена',
  'snack.paymentRecorded': 'Оплата отмечена',
  'snack.rescheduled': 'Расписание обновлено',
  'snack.undone': 'Отменено',

  // ── Quick actions (FAB on «Сегодня», spec 04-today) ──────────────────────
  'quick.title': 'Быстрое действие',
  'quick.newLesson': 'Новый урок',
  'quick.newLesson_client': 'Новая встреча',

  // ── Lesson card / form ───────────────────────────────────────────────────
  'lesson.topicPlaceholder': 'Тема урока',
  'lesson.topicPlaceholder_client': 'Тема встречи',
  'lesson.cancelReason': 'Причина отмены',
  'lesson.recordPayment': 'Отметить оплату',
  'lesson.choose': 'Выберите ученика',
  'lesson.choose_client': 'Выберите клиента',

  // ── Meeting link (delta v2.1 §3.1; prototype openMeetingLink/meetHost) ───
  'lesson.join': 'Подключиться',
  'lesson.openMeeting': 'Открыть встречу',
  'lesson.linkField': 'Ссылка на подключение',
  'lesson.payStatus': 'Статус оплаты',
  'field.link': 'Ссылка',
  'link.fallback': 'ссылка',
  'link.openFailed': 'Не удалось открыть ссылку',

  // ── Today ────────────────────────────────────────────────────────────────
  'today.next': 'Далее сегодня',
  'today.nothingNext': 'Больше занятий сегодня нет',
  'today.nothingNext_client': 'Больше встреч сегодня нет',
  'time.in': 'через',
  'time.now': 'Сейчас',

  // ── Schedule ─────────────────────────────────────────────────────────────
  'schedule.calendar': 'Календарь',
  'schedule.list': 'Список',
  'schedule.free': 'Свободно',
  'schedule.dayEmpty': 'Нет занятий',
  'schedule.dayEmpty_client': 'Нет встреч',
  // Day timeline (spec 05 §5.2; prototype DayTimeline)
  'schedule.now': 'Сейчас',
  'schedule.freeWindow': 'свободно', // «1 ч 30 мин свободно»
  'schedule.freeDay': 'свободный день',
  'schedule.freeDayHint': 'Можно добавить новый урок.',
  'schedule.freeDayHint_client': 'Можно добавить новую встречу.',
  'schedule.debtAmount': 'Долг', // «Долг 1 500 ₽»
  'status.conducted': 'Проведено',
  'status.conducted_client': 'Проведена',

  // ── Weekday short (Mon=1..Sun=0) ─────────────────────────────────────────
  'wd.1': 'Пн',
  'wd.2': 'Вт',
  'wd.3': 'Ср',
  'wd.4': 'Чт',
  'wd.5': 'Пт',
  'wd.6': 'Сб',
  'wd.0': 'Вс',

  // ── Months (nominative) ──────────────────────────────────────────────────
  'month.0': 'Январь',
  'month.1': 'Февраль',
  'month.2': 'Март',
  'month.3': 'Апрель',
  'month.4': 'Май',
  'month.5': 'Июнь',
  'month.6': 'Июль',
  'month.7': 'Август',
  'month.8': 'Сентябрь',
  'month.9': 'Октябрь',
  'month.10': 'Ноябрь',
  'month.11': 'Декабрь',

  // ── Months (genitive) — for inline "<day> <month>" dates («9 июня»); headers use nominative above ──
  'monthGen.0': 'января',
  'monthGen.1': 'февраля',
  'monthGen.2': 'марта',
  'monthGen.3': 'апреля',
  'monthGen.4': 'мая',
  'monthGen.5': 'июня',
  'monthGen.6': 'июля',
  'monthGen.7': 'августа',
  'monthGen.8': 'сентября',
  'monthGen.9': 'октября',
  'monthGen.10': 'ноября',
  'monthGen.11': 'декабря',

  // ── Accessibility labels (mode-neutral) ──────────────────────────────────
  'a11y.close': 'Закрыть',
  'a11y.prevMonth': 'Предыдущий месяц',
  'a11y.nextMonth': 'Следующий месяц',
  'a11y.prevYear': 'Предыдущий год',
  'a11y.nextYear': 'Следующий год',
  'a11y.signOut': 'Выйти из аккаунта',
  'a11y.themeMode': 'Тема оформления',
  'a11y.clientMode': 'Режим (ученик/клиент)',
  'a11y.clearSearch': 'Очистить поиск',
  'a11y.uiKit': 'UI-кит',

  // ── Not-found screen ─────────────────────────────────────────────────────
  'notFound.title': 'Экран не найден',
  'notFound.message': 'Такой страницы нет',
  'notFound.action': 'На главную',

  // ══ Phase 2 · Финансы + Аналитика ════════════════════════════════════════

  // ── Период (Финансы + Аналитика) ─────────────────────────────────────────
  'period.title': 'Период',
  'period.week': 'Неделя',
  'period.month': 'Месяц',
  'period.year': 'Год',
  'period.custom': 'Произвольный',
  'period.customTitle': 'Произвольный период',
  'period.pickDates': 'Выбрать даты',
  'period.pickHint': 'Выберите начальную и конечную дату периода',
  'period.apply': 'Применить',
  'period.selectStart': 'Выберите начальную дату',
  'period.selectYear': 'Выбрать год',

  // ── Способ оплаты (display) ──────────────────────────────────────────────
  'method.transfer': 'Перевод',
  'method.cash': 'Наличные',
  'method.card': 'Карта',

  // ── Финансы: сводка из трёх (spec 07 §7.1) ───────────────────────────────
  'finance.receivedFull': 'Фактически получено',
  'finance.receivedHint': 'По внесённым оплатам за выбранный период',
  'finance.expected': 'Ожидается',
  'finance.debtSummary': 'Задолженность',

  // ── Финансы: список + сводка ─────────────────────────────────────────────
  'finance.tab.all': 'Все',
  'finance.tab.paid': 'Оплачено',
  'finance.tab.debts': 'Долги',
  'finance.tab.expected': 'Ожидается',
  'finance.searchOps': 'Поиск по операциям',
  'finance.found': 'Найдено',
  'finance.allOps': 'Все операции',
  'finance.nothingFound': 'Ничего не найдено',
  'finance.emptyTitle': 'Операций нет',
  'finance.noOpsPeriod': 'За выбранный период операций нет',
  'finance.noOpsTab': 'По выбранной вкладке операций нет',

  // ── Финансы: деталь операции ─────────────────────────────────────────────
  'finance.opTitle': 'Операция',
  'finance.status': 'Статус',
  'finance.method': 'Способ оплаты',
  'finance.markPaidCta': 'Отметить оплаченным',
  'finance.toPay': 'к оплате',
  'finance.amount': 'Сумма',
  'finance.payDate': 'Дата оплаты',

  // ── Финансы: новая операция ──────────────────────────────────────────────
  'finance.newOp': 'Новая операция',
  'finance.opType': 'Тип операции',
  'op.paid': 'Оплата',
  'op.debt': 'Долг',
  'op.expected': 'Ожидается',
  'finance.subject': 'Предмет',
  'finance.subject_client': 'Тема встречи',
  'finance.comment': 'Комментарий',
  'finance.optional': 'Необязательно',
  'finance.saveOp': 'Сохранить операцию',
  'finance.chooseStudent': 'Выберите ученика',
  'finance.chooseStudent_client': 'Выберите клиента',

  // ── Финансы: фильтр ──────────────────────────────────────────────────────
  'finance.show': 'Показать',
  'sort.byDate': 'По дате',
  'sort.byAmount': 'По сумме',

  // ── Аналитика: показатели + KPI ──────────────────────────────────────────
  'analytics.income': 'Доход',
  'analytics.lessons': 'Уроки',
  'analytics.lessons_client': 'Встречи',
  'analytics.kpiLessons': 'Уроков',
  'analytics.kpiLessons_client': 'Встреч',
  'analytics.kpiCancels': 'Отмены',
  'analytics.kpiAvgCheck': 'Средний чек',
  'analytics.shares': 'Доли направлений',
  'analytics.topicsShort': 'тем',
  'analytics.top': 'Топ направлений',
  'analytics.byWeeks': 'Уроки по неделям',
  'analytics.byWeeks_client': 'Встречи по неделям',

  // ── Обзор: «Структура дохода» под-вкладки + «Выводы» (UI-v2 S11, spec 08 §8.1) ──
  'analytics.structure': 'Структура дохода',
  'analytics.byDirections': 'Направления',
  'analytics.byStudents': 'Ученики',
  'analytics.byStudents_client': 'Клиенты',
  'analytics.byFormat': 'Формат',
  'analytics.insights': 'Выводы',
  'analytics.insEmpty': 'Пока недостаточно данных для выводов',
  // Insight fragments — composed with a name/percent in the screen (generator stays lexicon-free).
  'analytics.insMainDir': 'основное направление',
  'analytics.insOfIncome': 'дохода за период',
  'analytics.insIncomeGrew': 'Доход вырос на',
  'analytics.insIncomeFell': 'Доход снизился на',
  'analytics.insVsCompare': 'относительно периода сравнения',
  // Comparison-period picker
  'analytics.comparePick': 'Период сравнения',
  'analytics.comparePrev': 'Предыдущий период',
  'analytics.vsCompare': 'по сравнению с выбранным периодом',

  // ── Динамика: метрики + график + «Главное за период» (UI-v2 S12, spec 08 §8.2) ──
  'dyn.mLessons': 'Занятия',
  'dyn.mLessons_client': 'Встречи',
  'dyn.mIncome': 'Доход',
  'dyn.mStudents': 'Ученики',
  'dyn.mStudents_client': 'Клиенты',
  'dyn.diff': 'Разница',
  // Headline subtitle fragments: «На 3 больше, чем за период сравнения — было 45»
  'dyn.by': 'На',
  'dyn.deltaMore': 'больше, чем за период сравнения',
  'dyn.deltaLess': 'меньше, чем за период сравнения',
  'dyn.was': 'было',
  // «Главное за период» — auto-highlight fragments
  'dyn.highlight': 'Главное за период',
  'dyn.hlGrowth': 'Основной рост пришёлся на отрезок',
  'dyn.hlDecline': 'Основное снижение пришлось на отрезок',
  'dyn.hlMoreTail': 'больше, чем за тот же отрезок сравнения',
  'dyn.hlLessTail': 'меньше, чем за тот же отрезок сравнения',
  'dyn.hlBy': 'на',
  'dyn.hlEmpty': 'Недостаточно данных для вывода за период',

  // ── Задолженности: aging + плитки + «Требуют внимания» (UI-v2 S13, spec 08 §8.3) ──
  'debt.awaiting': 'Ожидают оплаты',
  'debt.toPrev': 'к предыдущему периоду',
  'debt.withDebtTail': 'с долгом',
  'debt.overdueTile': 'просрочено',
  'debt.aging': 'По сроку',
  'debt.agingFresh': 'Ещё не просрочено',
  'debt.aging14': 'Просрочено до 14 дней',
  'debt.aging14plus': 'Больше 14 дней',
  'debt.attention': 'Требуют внимания',
  'debt.allInFinance': 'Все задолженности в финансах',

  // ── Экспорт: предпросмотр отчёта (UI-v2 S13, spec 08 §8.4) ────────────────
  'export.preview': 'Предпросмотр',
  'export.structure': 'Структура',
  'analytics.compareBtn': 'Сравнить',
  'analytics.currentPeriod': 'текущий период',
  'analytics.pastPeriod': 'прошлый период',

  // ── Аналитика: сравнение ─────────────────────────────────────────────────
  'analytics.comparison': 'Сравнение',
  'analytics.comparePeriod': 'Период сравнения',
  'analytics.vs': 'по сравнению с',
  'analytics.vsPrev': 'по сравнению с прошлым периодом',
  'analytics.noCompare': 'Нет данных для сравнения',
  'compare.prev': 'Предыдущий период',
  'compare.prevMonth': 'Прошлый месяц',
  'compare.prevYear': 'Прошлый год',
  'compare.custom': 'Произвольный период',

  // ── Аналитика: пусто / частично / задолженности ──────────────────────────
  'analytics.noDataHint': 'За выбранный период нет данных для аналитики. Выберите другой период.',
  'analytics.partial': 'Данные есть не за весь период',
  'analytics.noDebts': 'Активных задолженностей нет',
  'analytics.allPaid': 'Все оплаты получены',
  'analytics.debtTitle': 'Задолженность',

  // ── Экспорт (ADR-0012: CSV сейчас, PDF/Excel «скоро») ────────────────────
  'export.title': 'Экспорт отчёта',
  'export.format': 'Формат',
  'export.period': 'Период',
  'export.sections': 'Разделы',
  'export.income': 'Доходы',
  'export.lessons': 'Занятия',
  'export.lessons_client': 'Встречи',
  'export.debts': 'Задолженности',
  'export.generate': 'Сформировать отчёт',
  'export.soon': 'скоро',
  'export.done': 'Отчёт выгружен',

  // ── Финансы/Аналитика: общее ─────────────────────────────────────────────
  'common.reset': 'Сбросить',
  'group.today': 'Сегодня',

  // ══ Phase 3 · Уведомления + Настройки (ADR-0013) ══════════════════════════

  // ── Шапка / a11y ─────────────────────────────────────────────────────────
  'a11y.notifications': 'Уведомления',
  'a11y.profile': 'Профиль и настройки',
  'a11y.markRead': 'Отметить прочитанным',
  'a11y.unread': 'Непрочитано',

  // ── Лента: каркас ────────────────────────────────────────────────────────
  'notif.title': 'Уведомления',
  'notif.empty': 'Уведомлений нет',
  'notif.emptyHint': 'Здесь появятся напоминания о занятиях, оплатах и изменениях',
  'notif.emptyHint_client': 'Здесь появятся напоминания о встречах, оплатах и изменениях',
  'notif.emptyFiltered': 'Ничего не найдено',
  'notif.markAllRead': 'Прочитать всё',
  'notif.unreadOnly': 'Только непрочитанные',

  // ── Лента: фильтр по типу ────────────────────────────────────────────────
  'notif.filter.all': 'Все',
  'notif.filter.lesson': 'Занятия',
  'notif.filter.lesson_client': 'Встречи',
  'notif.filter.payment': 'Оплата',
  'notif.filter.schedule': 'Расписание',
  'notif.filter.system': 'Система',

  // ── Лента: группы по времени ─────────────────────────────────────────────
  'notif.group.today': 'Сегодня',
  'notif.group.yesterday': 'Вчера',
  'notif.group.earlier': 'Ранее',

  // ── Лента: заголовки по типу (kind) ──────────────────────────────────────
  'notif.reminder': 'Напоминание о занятии',
  'notif.reminder_client': 'Напоминание о встрече',
  'notif.payment': 'Оплата получена',
  'notif.debt': 'Зафиксирован долг',
  'notif.cancelled': 'Занятие отменено',
  'notif.cancelled_client': 'Встреча отменена',
  'notif.summary': 'План на сегодня',

  // ── Лента: вспомогательные ───────────────────────────────────────────────
  /** Title used by the OS reminder (ReminderSync) — short, mode-aware. */
  'notif.reminderTitle': 'Скоро занятие',
  'notif.reminderTitle_client': 'Скоро встреча',
  'notif.openLesson': 'Открыть занятие',
  'notif.openLesson_client': 'Открыть встречу',
  'notif.openOperation': 'Открыть операцию',

  // ── Настройки: секции ────────────────────────────────────────────────────
  'settings.notifications': 'Уведомления',
  'settings.mode': 'Режим',
  'settings.modeHint': 'Как называть тех, с кем вы работаете',
  'settings.profile': 'Профиль',
  'settings.profileName': 'Имя',
  'settings.activity': 'Вид деятельности',
  'settings.tz': 'Часовой пояс',

  // ── Настройки: режим (dual-mode) ─────────────────────────────────────────
  'mode.student': 'Ученик',
  'mode.client': 'Клиент',

  // ── Настройки: тема ──────────────────────────────────────────────────────
  'settings.themeSystem': 'Авто',
  'settings.themeLight': 'Светлая',
  'settings.themeDark': 'Тёмная',

  // ── Настройки: вид деятельности ──────────────────────────────────────────
  'activity.teacher': 'Преподаватель',
  'activity.psychologist': 'Психолог',
  'activity.coach': 'Коуч',
  'activity.mentor': 'Наставник',
  'activity.trainer': 'Тренер',

  // ── Настройки: напоминания (lead-time + тумблеры) ────────────────────────
  'settings.reminderLead': 'Напоминать заранее',
  'lead.10': 'За 10 минут',
  'lead.20': 'За 20 минут',
  'lead.60': 'За 1 час',
  'lead.1440': 'За 1 день',
  'settings.notifLessons': 'Напоминания о занятиях',
  'settings.notifLessons_client': 'Напоминания о встречах',
  'settings.notifPayment': 'Оплаты и долги',
  'settings.notifSchedule': 'Изменения расписания',
  'settings.notifSummary': 'Дневная сводка',

  // ── Настройки: push-разрешение ───────────────────────────────────────────
  'settings.push': 'Push-уведомления',
  'settings.pushRequest': 'Разрешить уведомления',
  'settings.pushGranted': 'Уведомления разрешены',
  'settings.pushDenied': 'Уведомления отключены — включите их в настройках браузера',

  // ── Настройки: отложенные секции (заглушки Ф4/Ф5) ────────────────────────
  'settings.account': 'Аккаунт и безопасность',
  'settings.backup': 'Резервная копия',
  'settings.support': 'Помощь и поддержка',
  'settings.soon': 'Скоро',
} as const;

export type Mode = 'tutor' | 'client';

type AllKeys = keyof typeof messages;
type ClientKey = Extract<AllKeys, `${string}_client`>;
/** Keys callers may pass to `t()` — base keys only (`_client` resolved internally). */
export type StringKey = Exclude<AllKeys, ClientKey>;

const M = messages as Record<string, string>;

/**
 * Resolve a key for the given mode (i18next `context` semantics):
 * client mode prefers `<key>_client`, falling back to the base value.
 */
export function t(key: StringKey, mode: Mode): string {
  if (mode === 'client') {
    const override = M[`${key}_client`];
    if (override != null) return override;
  }
  return M[key];
}
