import { sql } from 'void/db';
import { integer, primaryKey, sqliteTable, text } from 'void/schema-d1';

const createdAt = () => text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

/** 作成カードのボタンに入れる、短い期限つきの作成用トークン */
export const createTokens = sqliteTable('create_tokens', {
  token: text('token').primaryKey(),
  groupId: text('group_id').notNull(),
  name: text('name'),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: createdAt(),
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  /** ③の締切（ISO）。null は「なし」 */
  answerDeadline: text('answer_deadline'),
  /** collecting | candidates | tentative | decided */
  status: text('status').notNull().default('collecting'),
  tentativeDate: text('tentative_date'),
  tentativeUntil: text('tentative_until'),
  decidedDate: text('decided_date'),
  createdBy: text('created_by').notNull(),
  /** グループの人数（botを除く）。全員回答の判定に使う */
  groupSize: integer('group_size'),
  /** 最後にグループへ告知した状態のキー。同じなら告知しない */
  announcedKey: text('announced_key'),
  /** 告知を出す予定時刻（5分まとめと夜間の待ち合わせ） */
  announceAfter: text('announce_after'),
  /** 告知の前に付けるお知らせの文 */
  pendingNote: text('pending_note'),
  /** 締切「なし」で3日たったときの催促を出したか */
  deadlineNudgedAt: text('deadline_nudged_at'),
  reminderSentAt: text('reminder_sent_at'),
  createdAt: createdAt(),
});

export const participants = sqliteTable(
  'participants',
  {
    eventId: text('event_id').notNull(),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull(),
    wishText: text('wish_text'),
    firstAnsweredAt: text('first_answered_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

export const weekdayNg = sqliteTable(
  'weekday_ng',
  {
    eventId: text('event_id').notNull(),
    userId: text('user_id').notNull(),
    weekday: integer('weekday').notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId, t.weekday] })],
);

export const dateMarks = sqliteTable(
  'date_marks',
  {
    eventId: text('event_id').notNull(),
    userId: text('user_id').notNull(),
    date: text('date').notNull(),
    /** ng | ok | unknown */
    mark: text('mark').notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId, t.date] })],
);

export const candidateRounds = sqliteTable('candidate_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: text('event_id').notNull(),
  /** JSON の日付配列 */
  dates: text('dates').notNull(),
  deadline: text('deadline').notNull(),
  createdAt: createdAt(),
});

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: text('event_id'),
  userId: text('user_id'),
  action: text('action').notNull(),
  detail: text('detail'),
  at: createdAt(),
});
