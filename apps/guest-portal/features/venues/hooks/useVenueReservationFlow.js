'use client';

import { useCallback, useMemo, useState } from 'react';
import { createVenueReservation } from '../api/venueReservationApi';

export const VENUE_RESERVATION_STEPS = {
  CALENDAR: 'calendar',
  CHOOSE_TYPE: 'choose_type',
  EVENT_SELECT: 'event_select',
  TABLE_SELECT: 'table_select',
  RESTAURANT_DETAILS: 'restaurant_details',
  SUMMARY: 'summary',
  CONFIRMED: 'confirmed',
};

export function useVenueReservationFlow({ venue, upcomingEvents, onClose }) {
  const venueId = venue?.id || venue?.venueId || null;
  const venueName = venue?.name || 'Venue';
  const [step, setStep] = useState(VENUE_RESERVATION_STEPS.CALENDAR);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookingType, setBookingType] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [guests, setGuests] = useState(2);
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [loading, setLoading] = useState(false);

  const eventsByDate = useMemo(() => {
    const map = {};
    upcomingEvents.forEach((event) => {
      const date = new Date(event.startDate || event.startAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [upcomingEvents]);

  const eventsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return eventsByDate[key] || [];
  }, [eventsByDate, selectedDate]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let index = 0; index < firstDay; index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [currentMonth]);

  const getEventsForDay = useCallback(
    (date) => {
      if (!date) return [];
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return eventsByDate[key] || [];
    },
    [eventsByDate],
  );

  const goBack = useCallback(() => {
    switch (step) {
      case VENUE_RESERVATION_STEPS.CHOOSE_TYPE:
        setStep(VENUE_RESERVATION_STEPS.CALENDAR);
        break;
      case VENUE_RESERVATION_STEPS.EVENT_SELECT:
        setStep(VENUE_RESERVATION_STEPS.CHOOSE_TYPE);
        break;
      case VENUE_RESERVATION_STEPS.TABLE_SELECT:
        setStep(VENUE_RESERVATION_STEPS.EVENT_SELECT);
        break;
      case VENUE_RESERVATION_STEPS.RESTAURANT_DETAILS:
        setStep(VENUE_RESERVATION_STEPS.CHOOSE_TYPE);
        break;
      case VENUE_RESERVATION_STEPS.SUMMARY:
        setStep(
          bookingType === 'event'
            ? VENUE_RESERVATION_STEPS.TABLE_SELECT
            : VENUE_RESERVATION_STEPS.RESTAURANT_DETAILS,
        );
        break;
      default:
        onClose();
    }
  }, [bookingType, onClose, step]);

  const handleDateSelect = useCallback((date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return;
    setSelectedDate(date);
    setStep(VENUE_RESERVATION_STEPS.CHOOSE_TYPE);
  }, []);

  const handleEventSelect = useCallback((event) => {
    setSelectedEvent(event);
    if (event.tables?.length > 0) {
      setStep(VENUE_RESERVATION_STEPS.TABLE_SELECT);
      return;
    }
    setSelectedTier(event.tickets?.[0] || null);
    setStep(VENUE_RESERVATION_STEPS.SUMMARY);
  }, []);

  const handleTableSelect = useCallback((table) => {
    setSelectedTable(table);
    setGuests(table.capacity || 4);
    setStep(VENUE_RESERVATION_STEPS.SUMMARY);
  }, []);

  const handleTierSelect = useCallback((tier) => {
    setSelectedTier(tier);
    setStep(VENUE_RESERVATION_STEPS.SUMMARY);
  }, []);

  const resetAndClose = useCallback(() => {
    setStep(VENUE_RESERVATION_STEPS.CALENDAR);
    setSelectedDate(null);
    setBookingType(null);
    setSelectedEvent(null);
    setSelectedTable(null);
    setSelectedTier(null);
    setGuests(2);
    setSelectedTime('');
    setName('');
    setPhone('');
    setSpecialRequests('');
    setSubmitError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setSubmitError(null);
    try {
      if (!venueId) {
        throw new Error(
          'This venue is missing its reservation identity. Please refresh and try again.',
        );
      }
      await createVenueReservation({
        venueId,
        venueName,
        date: selectedDate?.toISOString(),
        time: selectedTime || selectedEvent?.startTime || '',
        guests,
        bookingType,
        guestName: name,
        guestPhone: phone,
        specialRequests,
        ...(bookingType === 'event' && {
          eventId: selectedEvent?.id,
          eventTitle: selectedEvent?.title || selectedEvent?.name,
          tableId: selectedTable?.id,
          tableName: selectedTable?.name,
          tierId: selectedTier?.id,
          tierName: selectedTier?.name,
        }),
      });
      setStep(VENUE_RESERVATION_STEPS.CONFIRMED);
    } catch (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    bookingType,
    guests,
    name,
    phone,
    selectedDate,
    selectedEvent,
    selectedTable,
    selectedTier,
    selectedTime,
    specialRequests,
    venueId,
    venueName,
  ]);

  const stepTitle = {
    [VENUE_RESERVATION_STEPS.CALENDAR]: 'Select Date',
    [VENUE_RESERVATION_STEPS.CHOOSE_TYPE]: selectedDate?.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    [VENUE_RESERVATION_STEPS.EVENT_SELECT]: 'Choose Event',
    [VENUE_RESERVATION_STEPS.TABLE_SELECT]: selectedEvent?.title || 'Select Package',
    [VENUE_RESERVATION_STEPS.RESTAURANT_DETAILS]: 'Restaurant Booking',
    [VENUE_RESERVATION_STEPS.SUMMARY]: 'Confirm Reservation',
    [VENUE_RESERVATION_STEPS.CONFIRMED]: 'Confirmed!',
  };

  return {
    bookingType,
    calendarDays,
    currentMonth,
    eventsOnDate,
    getEventsForDay,
    goBack,
    guests,
    handleDateSelect,
    handleEventSelect,
    handleSubmit,
    handleTableSelect,
    handleTierSelect,
    loading,
    name,
    phone,
    resetAndClose,
    selectedDate,
    selectedEvent,
    selectedTable,
    selectedTier,
    selectedTime,
    setBookingType,
    setCurrentMonth,
    setGuests,
    setName,
    setPhone,
    setSelectedTime,
    setSpecialRequests,
    specialRequests,
    step,
    stepTitle,
    submitError,
  };
}
