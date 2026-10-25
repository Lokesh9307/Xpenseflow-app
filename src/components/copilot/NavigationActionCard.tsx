import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getScreenMetadata } from '../../services/navigationRegistry';

interface NavigationActionCardProps {
  navigationAction: {
    screenId: string;
    title: string;
    description?: string;
  };
  onNavigate: (screenId: string) => void;
  theme: any;
}

export const NavigationActionCard: React.FC<NavigationActionCardProps> = ({
  navigationAction,
  onNavigate,
  theme,
}) => {
  const meta = getScreenMetadata(navigationAction.screenId);
  const iconName = (meta?.icon || 'navigate-circle-outline') as any;

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
        <View style={[styles.iconContainer, { backgroundColor: theme.accentPrimarySubtle }]}>
          <Ionicons name={iconName} size={20} color={theme.accentPrimary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {navigationAction.title || meta?.title || navigationAction.screenId}
          </Text>
          <Text style={[styles.description, { color: theme.textMuted }]}>
            {navigationAction.description || meta?.description || 'Registered application screen'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.accentPrimary }]}
        onPress={() => onNavigate(navigationAction.screenId)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Navigate to ${navigationAction.title}`}
      >
        <Text style={styles.buttonText}>Open Screen</Text>
        <Ionicons name="arrow-forward" size={16} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
