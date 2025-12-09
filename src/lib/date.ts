export const ymdToIso = (v?: string) =>
  !v ? undefined : new Date(v.replaceAll("/", "-")).toISOString();
