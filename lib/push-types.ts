export const NOTIFICATION_TOPICS = [
  "clear_sky_evening",
  "moon_visible",
  "planet_visible",
  "celestial_event",
  "daily_mission",
] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
export type NotificationPreferences = Record<NotificationTopic, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  clear_sky_evening: true,
  moon_visible: true,
  planet_visible: true,
  celestial_event: true,
  daily_mission: false,
};
