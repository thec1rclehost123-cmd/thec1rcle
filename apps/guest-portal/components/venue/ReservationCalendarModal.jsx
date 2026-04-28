"use client";

import {
    X,
    ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    useVenueReservationFlow,
    VENUE_RESERVATION_STEPS,
} from "../../features/venues/hooks/useVenueReservationFlow";
import { ReservationBookingTypeStep } from "../../features/venues/components/ReservationBookingTypeStep";
import { ReservationCalendarStep } from "../../features/venues/components/ReservationCalendarStep";
import { ReservationConfirmedStep } from "../../features/venues/components/ReservationConfirmedStep";
import { ReservationEventSelectionStep } from "../../features/venues/components/ReservationEventSelectionStep";
import { ReservationPackageSelectionStep } from "../../features/venues/components/ReservationPackageSelectionStep";
import { ReservationRestaurantDetailsStep } from "../../features/venues/components/ReservationRestaurantDetailsStep";
import { ReservationSummaryStep } from "../../features/venues/components/ReservationSummaryStep";

export default function ReservationCalendarModal({
    venue,
    upcomingEvents = [],
    isOpen,
    onClose
}) {
    const {
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
    } = useVenueReservationFlow({
        venue,
        upcomingEvents,
        onClose,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={resetAndClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />

            {/* Modal */}
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>

                <div className="px-6 pt-4 pb-4 border-b border-white/5 flex items-center gap-4">
                    {step !== VENUE_RESERVATION_STEPS.CALENDAR && step !== VENUE_RESERVATION_STEPS.CONFIRMED && (
                        <button
                            onClick={goBack}
                            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4 text-white/60" />
                        </button>
                    )}
                    <div className="flex-1">
                        <h2 className="text-lg font-black uppercase tracking-tight text-white">
                            {stepTitle[step]}
                        </h2>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-0.5">
                            {venue.name}
                        </p>
                    </div>
                    <button
                        onClick={resetAndClose}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                        <X className="h-4 w-4 text-white/60" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">
                    <AnimatePresence mode="wait">
                        {step === VENUE_RESERVATION_STEPS.CALENDAR && (
                            <ReservationCalendarStep
                                calendarDays={calendarDays}
                                currentMonth={currentMonth}
                                getEventsForDay={getEventsForDay}
                                handleDateSelect={handleDateSelect}
                                selectedDate={selectedDate}
                                setCurrentMonth={setCurrentMonth}
                            />
                        )}

                        {step === VENUE_RESERVATION_STEPS.CHOOSE_TYPE && (
                            <ReservationBookingTypeStep
                                eventsOnDate={eventsOnDate}
                                handleEventSelect={handleEventSelect}
                                setBookingType={setBookingType}
                                setStep={setStep}
                            />
                        )}

                        {step === VENUE_RESERVATION_STEPS.EVENT_SELECT && (
                            <ReservationEventSelectionStep
                                eventsOnDate={eventsOnDate}
                                handleEventSelect={handleEventSelect}
                            />
                        )}

                        {step === VENUE_RESERVATION_STEPS.TABLE_SELECT && selectedEvent && (
                            <ReservationPackageSelectionStep
                                handleTableSelect={handleTableSelect}
                                handleTierSelect={handleTierSelect}
                                selectedEvent={selectedEvent}
                            />
                        )}

                        {step === VENUE_RESERVATION_STEPS.RESTAURANT_DETAILS && (
                            <ReservationRestaurantDetailsStep
                                guests={guests}
                                name={name}
                                phone={phone}
                                selectedTime={selectedTime}
                                setGuests={setGuests}
                                setName={setName}
                                setPhone={setPhone}
                                setSelectedTime={setSelectedTime}
                                setSpecialRequests={setSpecialRequests}
                                setStep={setStep}
                                specialRequests={specialRequests}
                                summaryStep={VENUE_RESERVATION_STEPS.SUMMARY}
                            />
                        )}

                        {step === VENUE_RESERVATION_STEPS.SUMMARY && (
                            <ReservationSummaryStep
                                bookingType={bookingType}
                                guests={guests}
                                handleSubmit={handleSubmit}
                                loading={loading}
                                name={name}
                                phone={phone}
                                selectedDate={selectedDate}
                                selectedEvent={selectedEvent}
                                selectedTable={selectedTable}
                                selectedTier={selectedTier}
                                selectedTime={selectedTime}
                                setGuests={setGuests}
                                setName={setName}
                                setPhone={setPhone}
                                submitError={submitError}
                                venueName={venue.name}
                            />
                        )}

                        {step === VENUE_RESERVATION_STEPS.CONFIRMED && (
                            <ReservationConfirmedStep
                                guests={guests}
                                resetAndClose={resetAndClose}
                                selectedDate={selectedDate}
                                selectedEvent={selectedEvent}
                                venueName={venue.name}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
