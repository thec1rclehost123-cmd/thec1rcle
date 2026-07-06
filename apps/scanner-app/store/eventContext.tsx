import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface EventTier {
  id: string;
  name: string;
  price: number;
  entryType: string;
  available: boolean;
}

export interface EventData {
  valid: boolean;
  code: string;
  event: {
    id: string;
    title: string;
    venue: string;
    venueId: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    imageUrl?: string;
  };
  permissions: {
    canScan: boolean;
    canDoorEntry: boolean;
  };
  tiers: EventTier[];
  gate?: string;
  stats?: {
    totalEntered: number;
    prebooked: number;
    doorEntries: number;
    doorRevenue: number;
  };
}

interface EventContextType {
  eventData: EventData | null;
  setEventData: (data: EventData | null) => Promise<void>;
  clearEvent: () => Promise<void>;
  isAuthenticated: boolean;
  isRestoring: boolean;
}

const EVENT_STORAGE_KEY = '@scanner_event_data';
const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const [eventData, setEventState] = useState<EventData | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    // Restore event data on mount
    const restoreEvent = async () => {
      try {
        const stored = await AsyncStorage.getItem(EVENT_STORAGE_KEY);
        if (stored) {
          setEventState(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to restore event from storage', e);
      } finally {
        setIsRestoring(false);
      }
    };
    restoreEvent();
  }, []);

  const setEventData = async (data: EventData | null) => {
    setEventState(data);
    try {
      if (data) {
        await AsyncStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(data));
      } else {
        await AsyncStorage.removeItem(EVENT_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save event to storage', e);
    }
  };

  const clearEvent = async () => {
    await setEventData(null);
  };

  return (
    <EventContext.Provider
      value={{
        eventData,
        setEventData,
        clearEvent,
        isAuthenticated: !!eventData?.valid,
        isRestoring,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}

export default EventContext;
