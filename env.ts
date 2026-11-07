import { defineEnv, string } from 'void/env';

export default defineEnv({
  LINE_CHANNEL_SECRET: string(),
  LINE_CHANNEL_ACCESS_TOKEN: string(),
});
