import { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { PHONE_COUNTRIES, type PhoneCountry } from '@/lib/phone';

type CountryCodePickerProps = {
  selectedCountry: PhoneCountry;
  onSelect: (country: PhoneCountry) => void;
};

function getFlagEmoji(iso2: string) {
  const codePoints = iso2
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

export function CountryCodePicker({ selectedCountry, onSelect }: CountryCodePickerProps) {
  const [visible, setVisible] = useState(false);

  const openPicker = () => {
    Keyboard.dismiss();
    setVisible(true);
  };

  const selectCountry = (country: PhoneCountry) => {
    onSelect(country);
    setVisible(false);
  };

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`Change country code. ${selectedCountry.name} ${selectedCountry.dialCode} selected.`}
      >
        <Text style={styles.flagText}>{getFlagEmoji(selectedCountry.iso2)}</Text>
        <Text style={styles.dialText}>{selectedCountry.dialCode}</Text>
        <ChevronDown size={16} color="rgba(255,255,255,0.68)" strokeWidth={2.4} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Country code</Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={8}>
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {PHONE_COUNTRIES.map((country) => {
                const selected = country.iso2 === selectedCountry.iso2;
                return (
                  <Pressable
                    key={`${country.iso2}-${country.dialCode}`}
                    style={[styles.row, selected && styles.rowSelected]}
                    onPress={() => selectCountry(country)}
                  >
                    <View style={styles.countryDetails}>
                      <Text style={styles.rowFlagText}>{getFlagEmoji(country.iso2)}</Text>
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.countryName}>{country.name}</Text>
                        <Text style={styles.countryMeta}>{country.dialCode}</Text>
                      </View>
                    </View>
                    {selected ? <Check size={20} color="#FFFFFF" strokeWidth={2.6} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 52,
    minWidth: 104,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  flagText: {
    fontSize: 20,
    lineHeight: 24,
  },
  dialText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.66)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  closeText: {
    color: '#F44A22',
    fontSize: 14,
    fontWeight: '800',
  },
  list: {
    width: '100%',
  },
  row: {
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  countryDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowFlagText: {
    width: 30,
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  rowTextGroup: {
    flex: 1,
  },
  countryName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  countryMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
});
