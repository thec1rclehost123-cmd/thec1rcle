/**
 * PresetGrid
 *
 * Staff-facing grid of preset items for Cover Wallet debits.
 * Each item shows name, price, and a tap-to-select interaction.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export interface PresetItem {
    id: string;
    name: string;
    amountPaise: number;
    category?: string;
    isAvailable: boolean;
    sortOrder: number;
}

interface PresetGridProps {
    items: PresetItem[];
    onSelect: (item: PresetItem) => void;
    disabled?: boolean;
}

function formatPaise(paise: number): string {
    return `₹${(paise / 100).toFixed(0)}`;
}

export function PresetGrid({ items, onSelect, disabled = false }: PresetGridProps) {
    const available = [...items]
        .filter(i => i.isAvailable)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    if (available.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No preset items configured for this venue.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {available.map((item) => (
                <TouchableOpacity
                    key={item.id}
                    style={[styles.cell, disabled && styles.cellDisabled]}
                    onPress={() => !disabled && onSelect(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${formatPaise(item.amountPaise)}`}
                >
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemPrice}>{formatPaise(item.amountPaise)}</Text>
                    {item.category && (
                        <Text style={styles.category}>{item.category}</Text>
                    )}
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 24,
    },
    cell: {
        width: '47%',
        backgroundColor: 'rgba(168,85,247,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.3)',
        borderRadius: 12,
        padding: 14,
        alignItems: 'flex-start',
        minHeight: 80,
        justifyContent: 'space-between',
    },
    cellDisabled: {
        opacity: 0.4,
    },
    itemName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
        lineHeight: 17,
    },
    itemPrice: {
        fontSize: 18,
        fontWeight: '800',
        color: '#a855f7',
        marginTop: 6,
    },
    category: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: 2,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 14,
        textAlign: 'center',
    },
});
