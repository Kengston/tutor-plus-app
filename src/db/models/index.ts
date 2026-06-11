import { LessonModel } from './Lesson';
import { NotificationReadModel } from './NotificationRead';
import { ProfileModel } from './Profile';
import { StudentModel } from './Student';
import { StudentSubjectModel } from './StudentSubject';
import { SubjectModel } from './Subject';
import { TransactionModel } from './Transaction';

export { StudentModel } from './Student';
export { SubjectModel } from './Subject';
export { LessonModel } from './Lesson';
export { TransactionModel } from './Transaction';
export { StudentSubjectModel } from './StudentSubject';
export { ProfileModel } from './Profile';
export { NotificationReadModel } from './NotificationRead';

/** All model classes — passed to the `Database` constructor (see ../makeDatabase). */
export const modelClasses = [
  StudentModel,
  SubjectModel,
  LessonModel,
  TransactionModel,
  StudentSubjectModel,
  ProfileModel,
  NotificationReadModel,
];
