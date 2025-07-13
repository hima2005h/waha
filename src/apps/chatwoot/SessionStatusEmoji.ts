import { WAHASessionStatus } from '@waha/structures/enums.dto';

export function SessionStatusEmoji(status: WAHASessionStatus): string {
  switch (status) {
    case WAHASessionStatus.STOPPED:
      return '⚠️';
    case WAHASessionStatus.STARTING:
      return '⏳';
    case WAHASessionStatus.SCAN_QR_CODE:
      return '⚠️';
    case WAHASessionStatus.WORKING:
      return '🟢';
    case WAHASessionStatus.FAILED:
      return '🛑';
    default:
      return '❓';
  }
}
