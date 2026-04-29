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

export function computeActiveAcademicTerm(now: Date = new Date()): ActiveAcademicTerm {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

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
