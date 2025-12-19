import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as formatFn } from "date-fns";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(
  input: Date | string | number,
  options?: { includeTime?: boolean; format?: string }
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const pattern = options?.format ?? (options?.includeTime ? "MMM d, yyyy, p" : "MMM d, yyyy");
  return formatFn(date, pattern);
}

