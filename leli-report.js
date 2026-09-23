const TZ = 'America/Sao_Paulo';
const KINDS = ['in', 'breakOut', 'breakIn', 'out'];

const localTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthInfo(month) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month || ''));
  if (!match) throw new Error('Mês inválido.');
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    year,
    monthNumber,
    start: dateFromParts(year, monthNumber, 1),
    end: dateFromParts(year, monthNumber, days),
  };
}

function weekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function timeMinutes(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function localClock(value) {
  if (!value) return null;
  return localTimeFormatter.format(new Date(value));
}

function parseSchedule(value) {
  let schedule = value;
  if (typeof schedule === 'string') {
    try {
      schedule = JSON.parse(schedule);
    } catch {
      schedule = [];
    }
  }
  return Array.isArray(schedule)
    ? schedule.map((day) => ({
        weekday: Number(day.weekday),
        startTime: String(day.start_time || day.startTime || ''),
        breakStartTime: String(day.break_start_time || day.breakStartTime || ''),
        breakEndTime: String(day.break_end_time || day.breakEndTime || ''),
        endTime: String(day.end_time || day.endTime || ''),
      }))
    : [];
}

function scheduleForDate(versions, date) {
  const version = versions
    .filter((item) => item.effective_from <= date)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  if (!version) return null;
  return parseSchedule(version.schedule).find((day) => day.weekday === weekday(date)) || null;
}

function expectedMinutes(schedule) {
  if (!schedule) return 0;
  const values = [schedule.startTime, schedule.breakStartTime, schedule.breakEndTime, schedule.endTime].map(timeMinutes);
  if (values.some((value) => value === null)) return 0;
  return Math.max(0, values[1] - values[0]) + Math.max(0, values[3] - values[2]);
}

function requestCount(corrections) {
  return new Set(corrections.map((item) => item.request_group || item.id)).size;
}

function effectiveTimes(punches, corrections) {
  const times = {};
  for (const punch of punches) times[punch.kind] = localClock(punch.occurred_at);
  const approved = corrections
    .filter((item) => item.status === 'approved')
    .sort((a, b) => String(b.decided_at || '').localeCompare(String(a.decided_at || '')));
  for (const correction of approved) {
    if (!correction.kind || times[`corrected:${correction.kind}`]) continue;
    times[correction.kind] = localClock(correction.requested_at);
    times[`corrected:${correction.kind}`] = true;
  }
  return Object.fromEntries(KINDS.map((kind) => [kind, times[kind] || null]));
}

function workedMinutes(times) {
  const values = KINDS.map((kind) => timeMinutes(times[kind]));
  if (values.some((value) => value === null)) return null;
  if (values.some((value, index) => index > 0 && value < values[index - 1])) return null;
  return values[1] - values[0] + values[3] - values[2];
}

function statusForDay({ date, today, nowMinutes, schedule, hasPunches, complete, delayMinutes, pendingCorrections }) {
  if (!schedule) return complete ? 'Fora da escala' : 'Batidas incompletas';
  if (!hasPunches) {
    const shiftEnded = date < today || (date === today && nowMinutes > timeMinutes(schedule.endTime));
    return shiftEnded ? 'Falta' : 'Previsto hoje';
  }
  if (!complete) {
    const stillOpen = date === today && nowMinutes <= timeMinutes(schedule.endTime);
    return stillOpen ? 'Em andamento' : 'Batidas incompletas';
  }
  if (pendingCorrections) return 'Correção pendente';
  if (delayMinutes > 0) return 'Com atraso';
  return 'Completo';
}

function blankSummary(employee) {
  return {
    userId: employee.id,
    name: employee.name,
    unit: employee.unit,
    active: employee.active,
    expectedMinutes: 0,
    workedMinutes: 0,
    delayMinutes: 0,
    absenceDays: 0,
    incompleteDays: 0,
    correctionRequests: 0,
    pendingCorrections: 0,
  };
}

export function getMonthBounds(month) {
  const info = monthInfo(month);
  return { start: info.start, end: info.end };
}

export function buildMonthlyReport({ month, employees, punches, corrections, scheduleVersions, now = new Date() }) {
  const info = monthInfo(month);
  const today = localDateFormatter.format(now);
  const periodEnd = today < info.end ? today : info.end;
  const nowMinutes = timeMinutes(localClock(now));
  const rows = [];
  const employeeSummaries = [];

  for (const employee of employees) {
    const summary = blankSummary(employee);
    const employeePunches = punches.filter((item) => item.user_id === employee.id);
    const employeeCorrections = corrections.filter((item) => item.user_id === employee.id);
    const versions = scheduleVersions.filter((item) => item.user_id === employee.id);
    const reportCorrectionKeys = new Set(employeeCorrections.map((item) => item.request_group || item.id));
    const pendingCorrectionKeys = new Set(
      employeeCorrections.filter((item) => item.status === 'pending').map((item) => item.request_group || item.id),
    );
    summary.correctionRequests = reportCorrectionKeys.size;
    summary.pendingCorrections = pendingCorrectionKeys.size;

    if (periodEnd >= info.start) {
      const lastDay = Number(periodEnd.slice(8, 10));
      for (let day = 1; day <= lastDay; day += 1) {
        const date = dateFromParts(info.year, info.monthNumber, day);
        const schedule = scheduleForDate(versions, date);
        const dayPunches = employeePunches.filter((item) => item.work_date === date);
        const dayCorrections = employeeCorrections.filter((item) => item.work_date === date);
        if (!schedule && dayPunches.length === 0 && dayCorrections.length === 0) continue;

        const times = effectiveTimes(dayPunches, dayCorrections);
        const worked = workedMinutes(times);
        const complete = worked !== null;
        const expected = expectedMinutes(schedule);
        const arrival = timeMinutes(times.in);
        const scheduledArrival = schedule ? timeMinutes(schedule.startTime) : null;
        const delay = arrival !== null && scheduledArrival !== null ? Math.max(0, arrival - scheduledArrival) : 0;
        const pendingCorrections = requestCount(dayCorrections.filter((item) => item.status === 'pending'));
        const status = statusForDay({
          date,
          today,
          nowMinutes,
          schedule,
          hasPunches: dayPunches.length > 0,
          complete,
          delayMinutes: delay,
          pendingCorrections,
        });

        summary.expectedMinutes += expected;
        if (worked !== null) summary.workedMinutes += worked;
        summary.delayMinutes += delay;
        if (status === 'Falta') summary.absenceDays += 1;
        if (status === 'Batidas incompletas') summary.incompleteDays += 1;

        rows.push({
          date,
          userId: employee.id,
          name: employee.name,
          unit: employee.unit,
          schedule: schedule
            ? `${schedule.startTime}–${schedule.breakStartTime} / ${schedule.breakEndTime}–${schedule.endTime}`
            : 'Sem escala',
          punches: KINDS.map((kind) => times[kind]),
          expectedMinutes: expected,
          workedMinutes: worked,
          delayMinutes: delay,
          status,
          correctionRequests: requestCount(dayCorrections),
          pendingCorrections,
        });
      }
    }
    employeeSummaries.push(summary);
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.date.localeCompare(b.date));
  const totals = employeeSummaries.reduce(
    (result, item) => ({
      expectedMinutes: result.expectedMinutes + item.expectedMinutes,
      workedMinutes: result.workedMinutes + item.workedMinutes,
      delayMinutes: result.delayMinutes + item.delayMinutes,
      absenceDays: result.absenceDays + item.absenceDays,
      incompleteDays: result.incompleteDays + item.incompleteDays,
      correctionRequests: result.correctionRequests + item.correctionRequests,
      pendingCorrections: result.pendingCorrections + item.pendingCorrections,
    }),
    {
      expectedMinutes: 0,
      workedMinutes: 0,
      delayMinutes: 0,
      absenceDays: 0,
      incompleteDays: 0,
      correctionRequests: 0,
      pendingCorrections: 0,
    },
  );

  return {
    month,
    periodStart: info.start,
    periodEnd,
    generatedAt: now.toISOString(),
    totals,
    employees: employeeSummaries,
    rows,
  };
}
