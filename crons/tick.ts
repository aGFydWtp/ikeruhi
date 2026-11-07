import { defineScheduled } from 'void';
import { tick } from '../src/server/engine.ts';

// 毎分、締切と期限を見て状態を進め、予約された告知を出す
export const cron = '* * * * *';

export default defineScheduled(async (controller) => {
  await tick(new Date(controller.scheduledTime));
});
