"use client";

import { Section, FieldGroup, WizardInput, Reassurance, Hint } from "../WizardUI";
import { ShieldCheck } from "lucide-react";

/**
 * Step 5 — Capacity & Inventory
 * Mental Question: "How many people can actually come?"
 * 
 * UX Goals:
 * - Reinforce trust in the system's protection
 * - Avoid fear of overselling
 * - Clear, once: the system prevents overselling
 */

interface CapacityStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

export function CapacityStep({ formData, updateFormData, validationErrors }: CapacityStepProps) {
    // Calculate total tickets
    const totalTickets = formData.tickets?.reduce(
        (sum: number, t: any) => sum + (Number(t.quantity) || 0),
        0
    ) || 0;

    const capacityExceeded = totalTickets > (formData.capacity || 0);

    return (
        <div className="space-y-8">
            {/* Section: Venue Capacity */}
            <Section
                title="Venue Capacity"
                description="What's the maximum number of people this venue can hold?"
            >
                <FieldGroup>
                    <WizardInput
                        label="Maximum Capacity"
                        type="number"
                        min={1}
                        placeholder="500"
                        value={formData.capacity || ""}
                        onChange={(e) => updateFormData({
                            capacity: e.target.value === "" ? "" : parseInt(e.target.value) || 0
                        })}
                        hint="Set this based on the venue's legal or practical limit."
                    />
                </FieldGroup>
            </Section>

            {/* Section: Ticket Inventory Summary */}
            <Section
                title="Inventory Check"
                description="How your ticket quantities compare to capacity."
            >
                <FieldGroup>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-[14px] text-stone-600">Total Ticket Inventory</span>
                        <span className={`text-[18px] font-semibold ${capacityExceeded ? "text-red-600" : "text-stone-900"
                            }`}>
                            {totalTickets}
                        </span>
                    </div>
                    <div className="h-px bg-stone-200" />
                    <div className="flex items-center justify-between py-2">
                        <span className="text-[14px] text-stone-600">Venue Capacity</span>
                        <span className="text-[18px] font-semibold text-stone-900">
                            {formData.capacity || 0}
                        </span>
                    </div>

                    {capacityExceeded && (
                        <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-700">
                            Total tickets ({totalTickets}) exceed venue capacity ({formData.capacity}).
                            Reduce ticket quantities or increase capacity.
                        </div>
                    )}

                    {!capacityExceeded && totalTickets > 0 && (
                        <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-[13px] text-emerald-700 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Inventory is within capacity. You're good to go.
                        </div>
                    )}
                </FieldGroup>
            </Section>

            {/* Section: Per-Order Limits */}
            <Section
                title="Purchase Limits"
                description="Control how many tickets one person can buy."
            >
                <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                        <WizardInput
                            label="Minimum per Order"
                            type="number"
                            min={1}
                            value={formData.minTicketsPerOrder || 1}
                            onChange={(e) => updateFormData({
                                minTicketsPerOrder: parseInt(e.target.value) || 1
                            })}
                        />
                        <WizardInput
                            label="Maximum per Order"
                            type="number"
                            min={1}
                            value={formData.maxTicketsPerOrder || 10}
                            onChange={(e) => updateFormData({
                                maxTicketsPerOrder: parseInt(e.target.value) || 10
                            })}
                        />
                    </div>
                    <Hint>
                        This applies to all ticket types. It helps prevent bulk buying and ensures fair access.
                    </Hint>
                </FieldGroup>
            </Section>

            {/* System Protection Reassurance */}
            <Reassurance>
                The system automatically prevents overselling. No one can buy more tickets than available.
            </Reassurance>
        </div>
    );
}
