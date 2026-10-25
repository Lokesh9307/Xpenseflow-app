import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

interface NotificationDrawerProps {
  visible: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  visible,
  onClose,
  onUpdated,
}) => {
  const { isDark } = useTheme();

  const t = {
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    itemBg: isDark ? '#1C1C20' : '#F8FAFC',
    iconBg: isDark ? '#1F1F24' : '#F1F5F9',
    accentTeal: '#0D9488',
    overlayBg: 'rgba(0, 0, 0, 0.72)',
    handleBg: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const fetchNotifications = async () => {
    setLoading(true);
    const res = await api.getNotifications();
    setLoading(false);
    if (res.data && Array.isArray(res.data)) {
      setNotifications(res.data);
    }
  };

  const handleMarkAllRead = async () => {
    await api.markNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (onUpdated) onUpdated();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: t.overlayBg }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheetContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {/* Top Handle Grabber */}
          <View style={[styles.sheetHandle, { backgroundColor: t.handleBg }]} />

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: t.cardBorder }]}>
            <View style={styles.headerTitleRow}>
              <View>
                <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Notifications</Text>
                <Text style={[styles.sheetSub, { color: t.textMuted }]}>
                  Updates and budget alerts
                </Text>
              </View>
              {notifications.some((n) => !n.isRead) && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn}>
                  <Text style={[styles.markReadText, { color: t.accentTeal }]}>
                    Mark all read
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.iconBg }]}>
              <Feather name="x" size={18} color={t.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <ActivityIndicator
                size="large"
                color={t.accentTeal}
                style={{ marginTop: 40 }}
              />
            ) : notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconCircle, { backgroundColor: t.iconBg }]}>
                  <Ionicons name="notifications-off-outline" size={32} color={t.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
                  All caught up!
                </Text>
                <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
                  You have no pending notifications or budget alerts.
                </Text>
              </View>
            ) : (
              notifications.map((item) => (
                <View
                  key={item._id || item.id}
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: item.isRead ? t.itemBg : (isDark ? 'rgba(13, 148, 136, 0.12)' : '#CCFBF1'),
                      borderColor: item.isRead ? t.cardBorder : t.accentTeal,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.notifTitle,
                        { color: t.textPrimary, fontWeight: item.isRead ? '600' : '800' },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {!item.isRead && (
                      <View style={[styles.unreadDot, { backgroundColor: t.accentTeal }]} />
                    )}
                  </View>
                  <Text style={[styles.notifMessage, { color: t.textMuted }]}>
                    {item.message}
                  </Text>
                  {item.createdAt && (
                    <Text style={[styles.notifTime, { color: t.textMuted }]}>
                      {new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '82%',
    minHeight: '45%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  markReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 10,
  },
  notificationCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  notifTitle: {
    fontSize: 14,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
    lineHeight: 18,
  },
});
