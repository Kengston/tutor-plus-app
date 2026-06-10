/**
 * Dev seed (Phase 1). Mode-neutral data — the SAME rows read sensibly as Ученик/занятие
 * or Клиент/встреча via the dual-mode lexicon (ADR-0006); we don't seed per-mode. Runs
 * once (no-op if any student exists). LokiJS/IndexedDB persists across reloads, so this
 * seeds the first launch only. Produces a believable mix: lessons across past/today/week,
 * varied lifecycle, and paid/debt transactions so debts and payStatus dots are non-trivial.
 */
import type { CatColor } from '@/theme';
import { dayBounds } from '@/lib/time';

import { database } from '.';
import { LessonModel, StudentModel, StudentSubjectModel, SubjectModel, TransactionModel } from './models';
import type { Duration, LessonFormat, StudentStatus, TxnType } from '@/domain/types';

interface StudentSpec {
  name: string;
  category: CatColor;
  status: StudentStatus;
  format: LessonFormat;
  rate: number;
  schedule: string;
  phone: string;
  subjects: string[];
}

interface LessonSpec {
  student: string;
  subject: string;
  topic: string;
  day: number; // offset from today
  hour: number;
  min?: number;
  dur: Duration;
  fmt: LessonFormat;
  price: number;
  life: 'upcoming' | 'done' | 'cancelled';
  pay: TxnType | null;
}

const SUBJECTS = ['Английский', 'Математика', 'Подготовка к IELTS', 'Разговорный клуб', 'Физика'];

const STUDENTS: StudentSpec[] = [
  { name: 'Анна Котова', category: 'terracotta', status: 'active', format: 'online', rate: 1500, schedule: 'Пн, Ср · 16:00', phone: '+7 916 000-00-01', subjects: ['Английский', 'Подготовка к IELTS'] },
  { name: 'Игорь Лебедев', category: 'slate', status: 'active', format: 'inperson', rate: 2000, schedule: 'Вт, Чт · 18:00', phone: '+7 916 000-00-02', subjects: ['Математика', 'Физика'] },
  { name: 'Мария Сорокина', category: 'sage', status: 'active', format: 'online', rate: 1350, schedule: 'Сб · 11:00', phone: '+7 916 000-00-03', subjects: ['Разговорный клуб'] },
  { name: 'Дмитрий Орлов', category: 'ochre', status: 'paused', format: 'online', rate: 1600, schedule: 'Пн · 19:00', phone: '+7 916 000-00-04', subjects: ['Английский'] },
  { name: 'Елена Зайцева', category: 'rose', status: 'active', format: 'inperson', rate: 2200, schedule: 'Ср, Пт · 15:00', phone: '+7 916 000-00-05', subjects: ['Математика'] },
  { name: 'Павел Громов', category: 'lavender', status: 'archived', format: 'online', rate: 1400, schedule: '—', phone: '+7 916 000-00-06', subjects: ['Физика'] },
];

const LESSONS: LessonSpec[] = [
  // today
  { student: 'Анна Котова', subject: 'Английский', topic: 'Present Perfect', day: 0, hour: 10, dur: 60, fmt: 'online', price: 1500, life: 'done', pay: 'paid' },
  { student: 'Игорь Лебедев', subject: 'Математика', topic: 'Производные', day: 0, hour: 12, dur: 90, fmt: 'inperson', price: 3000, life: 'done', pay: 'debt' },
  { student: 'Мария Сорокина', subject: 'Разговорный клуб', topic: 'Small talk', day: 0, hour: 15, dur: 45, fmt: 'online', price: 1350, life: 'upcoming', pay: null },
  { student: 'Елена Зайцева', subject: 'Математика', topic: 'Интегралы', day: 0, hour: 17, dur: 60, fmt: 'inperson', price: 2200, life: 'upcoming', pay: null },
  // tomorrow
  { student: 'Анна Котова', subject: 'Подготовка к IELTS', topic: 'Writing Task 2', day: 1, hour: 11, dur: 60, fmt: 'online', price: 1500, life: 'upcoming', pay: null },
  { student: 'Игорь Лебедев', subject: 'Физика', topic: 'Кинематика', day: 1, hour: 18, dur: 60, fmt: 'inperson', price: 2000, life: 'upcoming', pay: null },
  // later this week
  { student: 'Елена Зайцева', subject: 'Математика', topic: 'Векторы', day: 2, hour: 15, dur: 60, fmt: 'inperson', price: 2200, life: 'upcoming', pay: null },
  { student: 'Мария Сорокина', subject: 'Разговорный клуб', topic: 'Debates', day: 3, hour: 11, dur: 45, fmt: 'online', price: 1350, life: 'upcoming', pay: null },
  // past — done, for paid/debt history
  { student: 'Игорь Лебедев', subject: 'Математика', topic: 'Пределы', day: -2, hour: 12, dur: 90, fmt: 'inperson', price: 3000, life: 'done', pay: 'debt' },
  { student: 'Дмитрий Орлов', subject: 'Английский', topic: 'Past Simple', day: -3, hour: 19, dur: 60, fmt: 'online', price: 1600, life: 'done', pay: 'paid' },
];

/**
 * Historical conducted+paid lessons across the past ~5 months (Phase 2, ADR-0012): gives
 * Analytics realistic monthly/weekly bars, an income growth trend (more recent months
 * busier), subject spread (donut / top directions) and a few extra debts (debtors list).
 * Deterministic (no RNG) so the seed stays reproducible across launches.
 */
function buildHistory(): LessonSpec[] {
  const active = STUDENTS.filter((s) => s.status !== 'archived');
  const perMonth = [9, 8, 7, 6, 5]; // monthsBack 1..5 — recent months busier → upward bars
  const out: LessonSpec[] = [];
  let n = 0;
  for (let mb = 1; mb <= perMonth.length; mb += 1) {
    for (let i = 0; i < perMonth[mb - 1]; i += 1) {
      const stu = active[n % active.length];
      const subject = stu.subjects[i % stu.subjects.length];
      const day = -(mb * 30) + ((i * 5) % 25) - 12; // cluster in the mb-th month back, ±~12d
      const hour = 10 + (i % 9);
      const pay: TxnType = mb <= 2 && i % 6 === 2 ? 'debt' : 'paid'; // a few recent debts
      out.push({ student: stu.name, subject, topic: subject, day, hour, dur: 60, fmt: stu.format, price: stu.rate, life: 'done', pay });
      n += 1;
    }
  }
  return out;
}

const HISTORY: LessonSpec[] = buildHistory();

export async function seedIfEmpty(): Promise<void> {
  const count = await database.get<StudentModel>('students').query().fetchCount();
  if (count > 0) return;

  const { start } = dayBounds();
  const at = (day: number, hour: number, min = 0) =>
    start + day * 86_400_000 + hour * 3_600_000 + min * 60_000;

  await database.write(async () => {
    const subjects = database.get<SubjectModel>('subjects');
    const students = database.get<StudentModel>('students');
    const joins = database.get<StudentSubjectModel>('student_subjects');
    const lessons = database.get<LessonModel>('lessons');
    const txns = database.get<TransactionModel>('transactions');

    const subjectId = new Map<string, string>();
    for (const name of SUBJECTS) {
      const s = await subjects.create((m) => {
        m.name = name;
      });
      subjectId.set(name, s.id);
    }

    const studentId = new Map<string, string>();
    for (const spec of STUDENTS) {
      const initials = spec.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const student = await students.create((m) => {
        m.name = spec.name;
        m.initials = initials;
        m.category = spec.category;
        m.status = spec.status;
        m.format = spec.format;
        m.rate = spec.rate;
        m.schedule = spec.schedule;
        m.phone = spec.phone;
      });
      studentId.set(spec.name, student.id);
      for (const subj of spec.subjects) {
        const sid = subjectId.get(subj);
        if (sid) await joins.create((m) => {
          m.studentId = student.id;
          m.subjectId = sid;
        });
      }
    }

    for (const spec of [...LESSONS, ...HISTORY]) {
      const sid = studentId.get(spec.student);
      if (!sid) continue;
      const subjId = subjectId.get(spec.subject) ?? null;
      const lesson = await lessons.create((m) => {
        m.studentId = sid;
        m.subjectId = subjId;
        m.topic = spec.topic;
        m.startsAt = at(spec.day, spec.hour, spec.min ?? 0);
        m.durationMin = spec.dur;
        m.format = spec.fmt;
        m.price = spec.price;
        m.lifecycleStatus = spec.life;
      });
      if (spec.pay) {
        await txns.create((m) => {
          m.studentId = sid;
          m.lessonId = lesson.id;
          m.amount = spec.price;
          m.type = spec.pay as TxnType;
          m.method = spec.pay === 'paid' ? 'transfer' : null;
          m.subjectId = subjId;
          m.occurredAt = at(spec.day, spec.hour, spec.min ?? 0);
        });
      }
    }
  });
}
