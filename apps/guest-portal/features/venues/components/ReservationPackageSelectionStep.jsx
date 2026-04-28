"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Ticket, Users } from "lucide-react";
import { TABLE_TYPE_CONFIG, formatCurrency } from "./reservationModalUtils";

export function ReservationPackageSelectionStep({
  handleTableSelect,
  handleTierSelect,
  selectedEvent,
}) {
  return (
    <motion.div
      key="table-select"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 p-6"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl">
          <Image
            src={selectedEvent.image || selectedEvent.poster || "/events/neon-nights.jpg"}
            fill
            className="object-cover"
            alt={selectedEvent.title || selectedEvent.name}
          />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-tight text-white">{selectedEvent.title || selectedEvent.name}</p>
          <p className="text-[10px] font-bold text-white/30">{selectedEvent.time || selectedEvent.startTime}</p>
        </div>
      </div>

      {selectedEvent.tables?.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Table Packages</h4>
          {selectedEvent.tables.map((table) => {
            const config = TABLE_TYPE_CONFIG[table.tableType] || TABLE_TYPE_CONFIG.standard;
            const TableIcon = config.icon;
            return (
              <button
                key={table.id}
                onClick={() => handleTableSelect(table)}
                className="group w-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${config.color}15` }}>
                    <TableIcon className="h-5 w-5" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-black text-white">{table.name}</h5>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Users className="h-3 w-3 text-white/30" />
                      <span className="text-[10px] font-bold text-white/40">Up to {table.capacity} guests</span>
                    </div>
                    {table.includes?.length > 0 ? (
                      <p className="mt-1 line-clamp-1 text-[9px] font-medium text-white/25">Includes: {table.includes.join(", ")}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-white">{formatCurrency(table.price)}</p>
                    {table.minimumSpend > 0 ? (
                      <p className="text-[9px] font-bold text-white/30">Min spend {formatCurrency(table.minimumSpend)}</p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedEvent.tickets?.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Entry / Cover</h4>
          {selectedEvent.tickets.map((tier) => (
            <button
              key={tier.id}
              onClick={() => handleTierSelect(tier)}
              className="group w-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all hover:border-[#F44A22]/30 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F44A22]/10">
                  <Ticket className="h-5 w-5 text-[#F44A22]" />
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-black text-white">{tier.name}</h5>
                  {tier.description ? <p className="mt-0.5 text-[10px] font-medium text-white/30">{tier.description}</p> : null}
                  {tier.genderRequirement && tier.genderRequirement !== "any" ? (
                    <span className="mt-1 inline-block rounded-full bg-purple-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-400">
                      {tier.genderRequirement === "couple" ? "Couple Entry" : `${tier.genderRequirement} Only`}
                    </span>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">{formatCurrency(tier.price)}</p>
                  <p className="text-[9px] font-bold text-white/30">per person</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
