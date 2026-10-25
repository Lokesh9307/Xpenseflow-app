import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ClarificationCardProps {
  clarification: {
    question: string;
    options: string[];
    missingField?: string;
  };
  onSelectOption: (option: string) => void;
  theme: any;
}

export const ClarificationCard: React.FC<ClarificationCardProps> = ({
  clarification,
  onSelectOption,
  theme,
}) => {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.bgElevated,
          borderColor: theme.borderSubtle,
        },
      ]}
    >
      <View style={styles.header}>
        <Ionicons name="help-circle-outline" size={18} color={theme.accentPrimary} />
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {clarification.question}
        </Text>
      </View>

      <View style={styles.chipsContainer}>
        {clarification.options.map((option, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.chip,
              {
                backgroundColor: theme.bgSurface,
                borderColor: theme.accentPrimary,
              },
            ]}
            onPress={() => onSelectOption(option)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Select option ${option}`}
          >
            <Text style={[styles.chipText, { color: theme.accentPrimary }]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
