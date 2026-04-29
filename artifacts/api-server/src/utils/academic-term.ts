export const INDONESIAN_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

export type IndonesianDay = "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";

export type SemesterType = "Ganjil" | "Genap";

export interface ActiveAcademicTerm {
  tahunAjaran: string;
  semesterType: SemesterType;
  startDate: string;
  endDate: string;
}

export const APP_TIMEZONE = "Asia/Jakarta";

interface JakartaDateParts {
  year: number;
  month: number;
  day: number;
  weekdayIdx: number;
}

export function getJakartaDateParts(now: Date = new Date()): JakartaDateParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekdayIdx: weekdayMap[get("weekday")] ?? 0,
  };
}

export function getJakartaDayName(now: Date = new Date()): typeof INDONESIAN_DAYS[number] {
  return INDONESIAN_DAYS[getJakartaDateParts(now).weekdayIdx];
}

export function computeActiveAcademicTerm(now: Date = new Date()): ActiveAcademicTerm {
  const { year, month } = getJakartaDateParts(now);

  if (month >= 8 && month <= 12) {
    return {
      tahunAjaran: `${year}/${year + 1}`,
      semesterType: "Ganjil",
      startDate: `${year}-08-01`,
      endDate: `${year + 1}-01-31`,
    };
  }
  if (month === 1) {
    return {
      tahunAjaran: `${year - 1}/${year}`,
      semesterType: "Ganjil",
      startDate: `${year - 1}-08-01`,
      endDate: `${year}-01-31`,
    };
  }
  return {
    tahunAjaran: `${year - 1}/${year}`,
    semesterType: "Genap",
    startDate: `${year}-02-01`,
    endDate: `${year}-07-31`,
  };
}
