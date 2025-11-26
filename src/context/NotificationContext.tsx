// src/context/NotificationContext.tsx
"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface NotificationContextType {
  notificationCount: number | null;
  setNotificationCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notificationCount: null,
  setNotificationCount: () => {}
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notificationCount, setNotificationCount] = useState<number | null>(null);

  // Set the initial value after component mounts (client-side only)
  useEffect(() => {
    setNotificationCount(8); // Your default count
  }, []);

  return (
    <NotificationContext.Provider value={{ notificationCount, setNotificationCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}