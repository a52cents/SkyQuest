export const NOTIFICATION_TOPICS = [
  "clear_sky_evening",
  "moon_visible",
  "planet_visible",
  "celestial_event",
  "daily_mission",
] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
export type NotificationPreferences = Record<NotificationTopic, boolean>;

export const TARGET_WATCH_REASONS = ["missed_retry", "collection_gap"] as const;
export type TargetWatchReason = (typeof TARGET_WATCH_REASONS)[number];

export type TargetWatch = {
  id: string;
  target: string;
  targetType: string;
  reason: TargetWatchReason;
  minimumScore: number;
  expiresAt: string;
  createdAt: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  clear_sky_evening: true,
  moon_visible: true,
  planet_visible: true,
  celestial_event: true,
  daily_mission: false,
};
