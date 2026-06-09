import { LessonModel } from './Lesson';
import { StudentModel } from './Student';
import { StudentSubjectModel } from './StudentSubject';
import { SubjectModel } from './Subject';
import { TransactionModel } from './Transaction';

export { StudentModel } from './Student';
export { SubjectModel } from './Subject';
export { LessonModel } from './Lesson';
export { TransactionModel } from './Transaction';
export { StudentSubjectModel } from './StudentSubject';

/** All model classes — passed to the `Database` constructor (see ../makeDatabase). */
export const modelClasses = [
  StudentModel,
  SubjectModel,
  LessonModel,
  TransactionModel,
  StudentSubjectModel,
];
