import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface DatePickerModalProps {
  visible: boolean;
  initialDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_HEADER = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  initialDate,
  onClose,
  onSelectDate,
}) => {
  const { theme, isDark } = useTheme();

  const parseInitialDate = () => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const [y, m, d] = initialDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState<Date>(parseInitialDate());
  const [selectedDate, setSelectedDate] = useState<Date>(parseInitialDate());

  useEffect(() => {
    if (visible) {
      const d = parseInitialDate();
      setViewDate(d);
      setSelectedDate(d);
    }
  }, [visible, initialDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Generate calendar grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const gridCells: { day: number; currentMonth: boolean; date: Date }[] = [];

  // Trailing days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    gridCells.push({
      day: d,
      currentMonth: false,
      date: new Date(year, month - 1, d),
    });
  }

  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push({
      day: d,
      currentMonth: true,
      date: new Date(year, month, d),
    });
  }

  // Next month filler
  const remainingCells = 42 - gridCells.length;
  for (let d = 1; d <= remainingCells; d++) {
    gridCells.push({
      day: d,
      currentMonth: false,
      date: new Date(year, month + 1, d),
    });
  }

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isSelected = (d: Date) => {
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  const formatDateToString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleConfirm = () => {
    onSelectDate(formatDateToString(selectedDate));
    onClose();
  };

  const handleQuickSelect = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d);
    setViewDate(d);
    onSelectDate(formatDateToString(d));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: theme.bgOverlay }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
              ]}
            >
              {/* Header Month / Year Navigation */}
              <View style={styles.headerRow}>
                <TouchableOpacity
                  style={[styles.navBtn, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}
                  onPress={handlePrevMonth}
                >
                  <Feather name="chevron-left" size={18} color={theme.textPrimary} />
                </TouchableOpacity>

                <View style={styles.monthTitleWrapper}>
                  <Text style={[styles.monthText, { color: theme.textPrimary }]}>
                    {MONTH_NAMES[month]} {year}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.navBtn, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}
                  onPress={handleNextMonth}
                >
                  <Feather name="chevron-right" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Quick shortcuts */}
              <View style={styles.shortcutRow}>
                <TouchableOpacity
                  style={[
                    styles.shortcutChip,
                    isToday(selectedDate) && styles.shortcutChipActive,
                    { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                  ]}
                  onPress={() => handleQuickSelect(0)}
                >
                  <Text
                    style={[
                      styles.shortcutText,
                      { color: isToday(selectedDate) ? '#f97316' : theme.textSecondary },
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.shortcutChip,
                    { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                  ]}
                  onPress={() => handleQuickSelect(-1)}
                >
                  <Text style={[styles.shortcutText, { color: theme.textSecondary }]}>
                    Yesterday
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Day Header Row */}
              <View style={styles.dayHeaderRow}>
                {DAYS_HEADER.map((d, idx) => (
                  <Text
                    key={idx}
                    style={[
                      styles.dayHeaderCell,
                      { color: idx === 0 || idx === 6 ? '#f97316' : theme.textMuted },
                    ]}
                  >
                    {d}
                  </Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.grid}>
                {gridCells.map((item, idx) => {
                  const sel = isSelected(item.date);
                  const today = isToday(item.date);

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.cell,
                        sel && styles.cellSelected,
                        today && !sel && [styles.cellToday, { borderColor: '#f97316' }],
                      ]}
                      onPress={() => {
                        setSelectedDate(item.date);
                        if (!item.currentMonth) {
                          setViewDate(item.date);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          {
                            color: sel
                              ? '#ffffff'
                              : item.currentMonth
                              ? theme.textPrimary
                              : theme.textMuted,
                            fontWeight: sel || today ? '700' : '400',
                          },
                        ]}
                      >
                        {item.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Footer Selection display & Confirm */}
              <View style={[styles.footerRow, { borderTopColor: theme.borderSubtle }]}>
                <View style={styles.selectedInfo}>
                  <Text style={[styles.selectedLabel, { color: theme.textMuted }]}>
                    Selected Date
                  </Text>
                  <Text style={[styles.selectedValue, { color: theme.textPrimary }]}>
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#f97316' }]}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmBtnText}>Set Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitleWrapper: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 17,
    fontWeight: '700',
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    justifyContent: 'center',
  },
  shortcutChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  shortcutChipActive: {
    borderColor: '#f97316',
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  cellSelected: {
    backgroundColor: '#f97316',
  },
  cellToday: {
    borderWidth: 1.5,
  },
  cellText: {
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  selectedValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  confirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
