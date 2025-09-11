import * as process from 'node:process';

import { parseBool } from '@waha/helpers';
import * as basicAuth from 'express-basic-auth';

export function BullAuthMiddleware() {
  let username = process.env.WAHA_DASHBOARD_USERNAME;
  let password = process.env.WAHA_DASHBOARD_PASSWORD;
  if (process.env.WAHA_DASHBOARD_ENABLED) {
    const enabled = parseBool(process.env.WAHA_DASHBOARD_ENABLED);
    // Generate a random uuid4 username /password to prevent access
    username = 'admin';
    password = crypto.randomUUID();
  }

  return basicAuth({
    challenge: true,
    users: {
      [username]: password,
    },
  });
}
