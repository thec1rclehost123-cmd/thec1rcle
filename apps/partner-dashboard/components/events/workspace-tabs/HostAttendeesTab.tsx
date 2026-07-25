'use client';

import {
  memo,
  useDeferredValue,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useQuery } from '@tanstack/react-query';

export interface AttendeeFilters {
  search: string;
  source: string;
  status: string;
  tierId: string;
  sort: string;
  page: number;
}

export interface HostAttendeesTabRenderState<TResponse> {
  attendeeSearch: string;
  setAttendeeSearch: Dispatch<SetStateAction<string>>;
  attendeeSource: string;
  setAttendeeSource: Dispatch<SetStateAction<string>>;
  attendeeStatus: string;
  setAttendeeStatus: Dispatch<SetStateAction<string>>;
  attendeeTierId: string;
  setAttendeeTierId: Dispatch<SetStateAction<string>>;
  attendeeSort: string;
  setAttendeeSort: Dispatch<SetStateAction<string>>;
  attendeePage: number;
  setAttendeePage: Dispatch<SetStateAction<number>>;
  attendees: TResponse | undefined;
  attendeesRefreshedAt: Date | null;
  attendeesQuery: {
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: () => Promise<unknown>;
  };
  refreshAttendees: () => void;
}

interface HostAttendeesTabProps<TResponse> {
  queryKey: readonly unknown[];
  enabled: boolean;
  loadAttendees: (filters: AttendeeFilters) => Promise<TResponse>;
  children: (state: HostAttendeesTabRenderState<TResponse>) => ReactNode;
}

function HostAttendeesTabComponent<TResponse>({
  queryKey,
  enabled,
  loadAttendees,
  children,
}: HostAttendeesTabProps<TResponse>) {
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const deferredAttendeeSearch = useDeferredValue(attendeeSearch);
  const [attendeeSource, setAttendeeSource] = useState('');
  const [attendeeStatus, setAttendeeStatus] = useState('');
  const [attendeeTierId, setAttendeeTierId] = useState('');
  const [attendeeSort, setAttendeeSort] = useState('newest');
  const [attendeePage, setAttendeePage] = useState(1);
  const [attendeesRefreshedAt, setAttendeesRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    setAttendeePage(1);
  }, [deferredAttendeeSearch, attendeeSource, attendeeStatus, attendeeTierId, attendeeSort]);

  const attendeesQuery = useQuery<TResponse, Error>({
    queryKey: [
      ...queryKey,
      deferredAttendeeSearch,
      attendeeSource,
      attendeeStatus,
      attendeeTierId,
      attendeeSort,
      attendeePage,
    ],
    queryFn: () =>
      loadAttendees({
        search: deferredAttendeeSearch,
        source: attendeeSource,
        status: attendeeStatus,
        tierId: attendeeTierId,
        sort: attendeeSort,
        page: attendeePage,
      }),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (attendeesQuery.data && !attendeesRefreshedAt) {
      setAttendeesRefreshedAt(new Date());
    }
  }, [attendeesQuery.data, attendeesRefreshedAt]);

  const refreshAttendees = () => {
    void attendeesQuery.refetch();
    setAttendeesRefreshedAt(new Date());
  };

  return children({
    attendeeSearch,
    setAttendeeSearch,
    attendeeSource,
    setAttendeeSource,
    attendeeStatus,
    setAttendeeStatus,
    attendeeTierId,
    setAttendeeTierId,
    attendeeSort,
    setAttendeeSort,
    attendeePage,
    setAttendeePage,
    attendees: attendeesQuery.data,
    attendeesRefreshedAt,
    attendeesQuery: {
      isLoading: attendeesQuery.isLoading,
      isFetching: attendeesQuery.isFetching,
      error: attendeesQuery.error,
      refetch: attendeesQuery.refetch,
    },
    refreshAttendees,
  });
}

export const HostAttendeesTab = memo(HostAttendeesTabComponent) as typeof HostAttendeesTabComponent;
