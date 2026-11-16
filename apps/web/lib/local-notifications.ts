export type LocalNotificationKind = 'ticket_reply';

export interface LocalNotification {
  id: string;
  kind: LocalNotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

export const LOCAL_NOTIFICATIONS_KEY = 'alisales-local-notifications';
export const LOCAL_NOTIFICATIONS_EVENT = 'alisales:notify';

export function readLocalNotifications(): LocalNotification[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_NOTIFICATIONS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (row): row is LocalNotification =>
            Boolean(row) &&
            typeof (row as LocalNotification).id === 'string' &&
            // Older bookmark/price-drop rows are purged on read: price drops
            // now come from the server event history, and bookmarking is silent.
            (row as LocalNotification).kind === 'ticket_reply',
        )
      : [];
  } catch {
    return [];
  }
}

export function pushLocalNotification(
  item: Omit<LocalNotification, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  },
): void {
  const entry: LocalNotification = {
    ...item,
    id: item.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: item.createdAt ?? new Date().toISOString(),
  };
  try {
    const current = readLocalNotifications().filter((row) => row.id !== entry.id);
    localStorage.setItem(
      LOCAL_NOTIFICATIONS_KEY,
      JSON.stringify([entry, ...current].slice(0, 20)),
    );
  } catch {
    // Private mode still gets the live event below.
  }
  window.dispatchEvent(new CustomEvent(LOCAL_NOTIFICATIONS_EVENT));
}
