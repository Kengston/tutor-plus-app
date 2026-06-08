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
