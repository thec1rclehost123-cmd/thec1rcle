"use client";

import EventCard from "./EventCard";
import { VirtuosoGrid } from "react-virtuoso";
import { forwardRef } from "react";


const GridContainer = forwardRef((props, ref) => (
  <div {...props} ref={ref} className="grid grid-cols-1 gap-6 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4" />
));
GridContainer.displayName = "GridContainer";

const ItemContainer = forwardRef((props, ref) => (
  <div {...props} ref={ref} className="h-full w-full" />
));
ItemContainer.displayName = "ItemContainer";

import { ErrorBoundary } from "@c1rcle/ui";

export default function ExploreEventGrid({ events = [] }) {
  if (!events.length) return null;

  return (
    <ErrorBoundary>
      <VirtuosoGrid
        useWindowScroll
        data={events}
        components={{
          List: GridContainer,
          Item: ItemContainer
        }}
        computeItemKey={(index, event) => event.id || `event-${index}`}
        itemContent={(index, event) => (
          <EventCard event={event} index={index} height="h-[200px] sm:h-[280px] md:h-[500px]" />
        )}
      />
    </ErrorBoundary>
  );
}
