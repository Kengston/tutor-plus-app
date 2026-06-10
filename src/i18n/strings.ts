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

  // ── Schedule ─────────────────────────────────────────────────────────────
  'schedule.title': 'Расписание уроков',
  'schedule.title_client': 'Расписание встреч',
  'schedule.empty': 'Здесь появится расписание',

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

  // ── Phase 1 · common actions & units ─────────────────────────────────────
  'common.edit': 'Изменить',
  'common.delete': 'Удалить',
  'common.done': 'Готово',
  'common.copied': 'Скопировано',
  'common.of': 'из',
  'common.none': '—',
  'common.tomorrow': 'Завтра',
  'common.min': 'мин',
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
  'sort.label': 'Сортировка',
  'sort.name': 'Имя',
  'sort.added': 'Дата добавления',
  'sort.status': 'Статус',
  'sort.debt': 'Долг',
  'students.search': 'Поиск учеников',
  'students.search_client': 'Поиск клиентов',
  'students.archive': 'Архивировать',
  'students.emptyFiltered': 'Никого не найдено',

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

  // ── Student form ─────────────────────────────────────────────────────────
  'form.editTitle': 'Редактирование',
  'form.namePlaceholder': 'Имя ученика',
  'form.namePlaceholder_client': 'Имя клиента',
  'form.schedulePlaceholder': 'Напр. Пн, Ср · 16:00',
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

  // ── Lesson card / form ───────────────────────────────────────────────────
  'lesson.topicPlaceholder': 'Тема урока',
  'lesson.topicPlaceholder_client': 'Тема встречи',
  'lesson.cancelReason': 'Причина отмены',
  'lesson.recordPayment': 'Отметить оплату',
  'lesson.choose': 'Выберите ученика',
  'lesson.choose_client': 'Выберите клиента',

  // ── Today ────────────────────────────────────────────────────────────────
  'today.progress': 'Проведено',
  'today.next': 'Далее сегодня',
  'today.nothingNext': 'Больше занятий сегодня нет',
  'today.nothingNext_client': 'Больше встреч сегодня нет',
  'today.tomorrowPreview': 'Завтра',
  'time.in': 'через',
  'time.now': 'Сейчас',

  // ── Schedule ─────────────────────────────────────────────────────────────
  'schedule.calendar': 'Календарь',
  'schedule.list': 'Список',
  'schedule.free': 'Свободно',
  'schedule.dayEmpty': 'Нет занятий',
  'schedule.dayEmpty_client': 'Нет встреч',

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
  'analytics.debt': 'Долг',
  'analytics.kpiLessons': 'Уроков',
  'analytics.kpiLessons_client': 'Встреч',
  'analytics.kpiCancels': 'Отмены',
  'analytics.kpiAvgCheck': 'Средний чек',
  'analytics.shares': 'Доли направлений',
  'analytics.topicsShort': 'тем',
  'analytics.top': 'Топ направлений',
  'analytics.byWeeks': 'Уроки по неделям',
  'analytics.byWeeks_client': 'Встречи по неделям',
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
  'analytics.debtors': 'Ученики с долгом',
  'analytics.debtors_client': 'Клиенты с долгом',
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
