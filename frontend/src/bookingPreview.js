import { useSyncExternalStore } from "react";

export const previewMovies = [
  { title: "Рататуй", duration: 111 },
  { title: "Интерстеллар", duration: 169 },
];

export const previewHalls = ["Панорамный зал"];

const initialScreenings = [
  {
    id: 1,
    title: "Рататуй",
    hall: "Панорамный зал",
    startsAt: "2026-11-14T14:00",
    duration: 111,
  },
  {
    id: 2,
    title: "Интерстеллар",
    hall: "Панорамный зал",
    startsAt: "2026-11-14T17:00",
    duration: 169,
  },
];

export const previewBookings = [
  {
    id: 101,
    viewer: "Катя",
    screeningId: 1,
    seats: [
      { row: 3, number: 5 },
      { row: 3, number: 6 },
    ],
  },
];

export const bookingLabels = {
  pending: "Ожидает подтверждения",
  approved: "Одобрена",
  cancel_requested: "Ожидает подтверждения отмены",
  cancelled: "Отменена",
};

const allowedChanges = {
  pending: ["approved", "cancel_requested"],
  approved: ["cancel_requested"],
  cancel_requested: ["cancelled"],
  cancelled: [],
};

const screeningsKey = "cinema.preview.screenings.v1";
const updateEvent = "cinema-preview-booking-change";
const cleaningMinutes = 15;

function subscribe(listener) {
  window.addEventListener("storage", listener);
  window.addEventListener(updateEvent, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(updateEvent, listener);
  };
}

function write(key, value) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new Event(updateEvent));
}

function statusKey(id) {
  return `cinema.preview.booking.${id}.status`;
}

function readStatus(id) {
  const value = localStorage.getItem(statusKey(id));
  return Object.hasOwn(bookingLabels, value) ? value : "pending";
}

export function useBookingStatus(id) {
  return useSyncExternalStore(subscribe, () => readStatus(id));
}

export function changeBookingStatus(id, nextStatus) {
  if (!allowedChanges[readStatus(id)].includes(nextStatus)) return false;

  write(statusKey(id), nextStatus);
  return true;
}

function readSchedule() {
  return localStorage.getItem(screeningsKey);
}

function parseSchedule(value) {
  if (!value) return initialScreenings;

  try {
    const saved = JSON.parse(value);
    return Array.isArray(saved) ? saved : initialScreenings;
  } catch {
    return initialScreenings;
  }
}

export function useScreenings() {
  const value = useSyncExternalStore(subscribe, readSchedule);
  return parseSchedule(value);
}

export function formatStart(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function overlaps(first, second) {
  const firstStart = new Date(first.startsAt).getTime();
  const secondStart = new Date(second.startsAt).getTime();
  const firstEnd = firstStart + (first.duration + cleaningMinutes) * 60_000;
  const secondEnd = secondStart + (second.duration + cleaningMinutes) * 60_000;

  return firstStart < secondEnd && secondStart < firstEnd;
}

export function savePreviewScreening(screening) {
  const screenings = parseSchedule(readSchedule());
  const conflict = screenings.find(
    (item) =>
      item.id !== screening.id &&
      item.hall === screening.hall &&
      overlaps(item, screening),
  );

  if (conflict) {
    return (
      `В зале «${conflict.hall}» на это время уже назначен сеанс ` +
      `«${conflict.title}» (${formatStart(conflict.startsAt)}). ` +
      "Между показами нужно оставить 15 минут на уборку."
    );
  }

  const exists = screenings.some((item) => item.id === screening.id);
  const updated = exists
    ? screenings.map((item) => (item.id === screening.id ? screening : item))
    : [...screenings, screening];

  write(screeningsKey, JSON.stringify(updated));
  return "";
}
