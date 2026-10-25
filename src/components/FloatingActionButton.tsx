import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface FABProps {
  onAddExpense: () => void;
  onAddSplit: () => void;
  onAddTiffin: () => void;
  onOpenCalculator: () => void;
}

export const FloatingActionButton: React.FC<FABProps> = ({
  onAddExpense,
  onAddSplit,
  onAddTiffin,
  onOpenCalculator,
}) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen(!open);

  const handleAction = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <>
      {/* Expanded Actions Modal Backdrop */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={[styles.backdrop, { backgroundColor: theme.bgOverlay }]}>
            <View style={styles.actionMenu}>
              {/* Add Expense */}
              <TouchableOpacity
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => handleAction(onAddExpense)}
              >
                <View style={[styles.actionLabelContainer, { backgroundColor: theme.bgSurface }]}>
                  <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Add Expense</Text>
                </View>
                <View style={[styles.actionButton, { backgroundColor: '#7C3AED' }]}>
                  <Feather name="plus" size={20} color="#ffffff" />
                </View>
              </TouchableOpacity>

              {/* Add Split */}
              <TouchableOpacity
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => handleAction(onAddSplit)}
              >
                <View style={[styles.actionLabelContainer, { backgroundColor: theme.bgSurface }]}>
                  <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Split Cost</Text>
                </View>
                <View style={[styles.actionButton, { backgroundColor: '#0D9488' }]}>
                  <Feather name="users" size={18} color="#ffffff" />
                </View>
              </TouchableOpacity>

              {/* Add Tiffin */}
              <TouchableOpacity
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => handleAction(onAddTiffin)}
              >
                <View style={[styles.actionLabelContainer, { backgroundColor: theme.bgSurface }]}>
                  <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Tiffin Meal</Text>
                </View>
                <View style={[styles.actionButton, { backgroundColor: '#D97706' }]}>
                  <MaterialCommunityIcons name="silverware-fork-knife" size={18} color="#ffffff" />
                </View>
              </TouchableOpacity>

              {/* Calculator */}
              <TouchableOpacity
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => handleAction(onOpenCalculator)}
              >
                <View style={[styles.actionLabelContainer, { backgroundColor: theme.bgSurface }]}>
                  <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Calculator</Text>
                </View>
                <View style={[styles.actionButton, { backgroundColor: '#2563EB' }]}>
                  <Ionicons name="calculator-outline" size={19} color="#ffffff" />
                </View>
              </TouchableOpacity>

              {/* Close Button matching main FAB */}
              <TouchableOpacity
                style={[styles.mainFab, { backgroundColor: theme.danger }]}
                activeOpacity={0.85}
                onPress={toggle}
              >
                <Feather name="x" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Persistent Floating Button */}
      {!open && (
        <TouchableOpacity
          style={[styles.mainFab, styles.floatingPosition, { backgroundColor: theme.accentPrimary }]}
          activeOpacity={0.85}
          onPress={toggle}
        >
          <Feather name="plus" size={26} color="#ffffff" />
        </TouchableOpacity>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 85,
    paddingRight: 20,
  },
  actionMenu: {
    alignItems: 'flex-end',
    gap: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabelContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingPosition: {
    position: 'absolute',
    bottom: 85,
    right: 20,
    zIndex: 99,
  },
});
