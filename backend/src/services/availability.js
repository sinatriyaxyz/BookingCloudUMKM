import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const SLOT_STEP_MIN = 30;

export function parseTimeToMinutes(timeVal) {
  if (!timeVal) return null;
  const str = String(timeVal).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function parseDateTime(val, baseDate) {
  if (!val) return null;
  if (dayjs.isDayjs(val)) {
    return val.tz ? val.tz('Asia/Jakarta') : dayjs(val).tz('Asia/Jakarta');
  }
  if (val instanceof Date) {
    return dayjs(val).tz('Asia/Jakarta');
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed.includes('-')) {
      const timePart = trimmed.length === 5 ? `${trimmed}:00` : trimmed;
      return dayjs.tz(`${baseDate} ${timePart}`, 'Asia/Jakarta');
    }
    return dayjs.tz(trimmed, 'Asia/Jakarta');
  }
  return dayjs(val).tz('Asia/Jakarta');
}

function parseNow(now, baseDate) {
  if (!now) return dayjs().tz('Asia/Jakarta');
  return parseDateTime(now, baseDate) || dayjs().tz('Asia/Jakarta');
}

export function computeSlots({
  date,
  durationMin,
  openTime,
  closeTime,
  isClosed = false,
  isHoliday = false,
  activeBookings = [],
  now = null,
}) {
  if (isClosed || isHoliday) {
    return [];
  }

  if (!date || !durationMin || durationMin <= 0) {
    return [];
  }

  const openTotalMin = parseTimeToMinutes(openTime);
  const closeTotalMin = parseTimeToMinutes(closeTime);

  if (openTotalMin === null || closeTotalMin === null) {
    return [];
  }

  if (openTotalMin >= closeTotalMin || durationMin > (closeTotalMin - openTotalMin)) {
    return [];
  }

  const currentNow = parseNow(now, date);

  const parsedBookings = (activeBookings || [])
    .map((b) => {
      const rawStart = b.start_at || b.startAt || b.start;
      const rawEnd = b.end_at || b.endAt || b.end;
      return {
        start: parseDateTime(rawStart, date),
        end: parseDateTime(rawEnd, date),
      };
    })
    .filter((b) => b.start && b.end && b.start.isValid() && b.end.isValid());

  const slots = [];

  for (
    let slotStartMin = openTotalMin;
    slotStartMin + durationMin <= closeTotalMin;
    slotStartMin += SLOT_STEP_MIN
  ) {
    const hStr = String(Math.floor(slotStartMin / 60)).padStart(2, '0');
    const mStr = String(slotStartMin % 60).padStart(2, '0');
    const slotTimeStr = `${hStr}:${mStr}`;

    const slotStartDayjs = dayjs.tz(`${date} ${slotTimeStr}:00`, 'Asia/Jakarta');
    const slotEndDayjs = slotStartDayjs.add(durationMin, 'minute');

    // Slot yang sudah lewat dari now (WIB) dibuang
    if (slotStartDayjs.valueOf() <= currentNow.valueOf()) {
      continue;
    }

    // Tidak beririsan dengan booking aktif ([mulai, selesai))
    // Overlap terjadi jika slotStart < bEnd && bStart < slotEnd
    const hasConflict = parsedBookings.some((b) => {
      return slotStartDayjs.valueOf() < b.end.valueOf() && b.start.valueOf() < slotEndDayjs.valueOf();
    });

    if (!hasConflict) {
      slots.push(slotTimeStr);
    }
  }

  return slots;
}

export default computeSlots;

