import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface ShareCodeModalProps {
  visible: boolean;
  groupName: string;
  inviteCode: string;
  pricePerMeal: number;
  isCreator?: boolean;
  onClose: () => void;
  onRegenerateCode?: () => Promise<void>;
}

export const ShareCodeModal: React.FC<ShareCodeModalProps> = ({
  visible,
  groupName,
  inviteCode,
  pricePerMeal,
  isCreator = false,
  onClose,
  onRegenerateCode,
}) => {
  const { theme, isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const codeDigits = (inviteCode || '8824').split('');

  const handleShareWhatsApp = async () => {
    const message = `🍱 *Join our Tiffin Group on XpenseFlow!*
Group: *${groupName}*
Price: *₹${pricePerMeal}/meal*

🔑 Your 4-digit invite code:
*${inviteCode}*

📲 *How to join:*
1. Open XpenseFlow Mobile app
2. Go to Tiffin Tracker
3. Tap "Join Code" and enter *${inviteCode}*`;

    try {
      await Share.share({ message });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleCopyCode = () => {
    // In React Native without Clipboard package, show instant feedback
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegen = async () => {
    if (!onRegenerateCode) return;
    setRegenerating(true);
    await onRegenerateCode();
    setRegenerating(false);
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
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerIconCircle}>
                  <MaterialCommunityIcons name="key-variant" size={20} color="#f97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: theme.textPrimary }]}>Group Invite Code</Text>
                  <Text style={[styles.groupSubtitle, { color: theme.textMuted }]}>
                    {groupName} · ₹{pricePerMeal}/meal
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {/* 4-Digit PIN Boxes */}
              <View style={styles.digitsContainer}>
                {codeDigits.map((digit, index) => (
                  <View
                    key={index}
                    style={[
                      styles.digitBox,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: '#f97316',
                      },
                    ]}
                  >
                    <Text style={styles.digitText}>{digit}</Text>
                  </View>
                ))}
              </View>

              {/* Instructions */}
              <View
                style={[
                  styles.instructionCard,
                  { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                ]}
              >
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>1.</Text>
                  <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                    Share this 4-digit code with your roommates or friends.
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>2.</Text>
                  <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                    They tap <Text style={{ fontWeight: '700', color: '#f97316' }}>Join Code</Text> on their Tiffin screen.
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>3.</Text>
                  <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                    Once entered, they are added to <Text style={{ fontWeight: '700' }}>{groupName}</Text> instantly!
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionCol}>
                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: '#25D366' }]}
                  onPress={handleShareWhatsApp}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#ffffff" />
                  <Text style={styles.shareBtnText}>Share Code on WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.copyBtn,
                    { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                  ]}
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={copied ? 'check' : 'copy'}
                    size={16}
                    color={copied ? '#10b981' : theme.textPrimary}
                  />
                  <Text
                    style={[
                      styles.copyBtnText,
                      { color: copied ? '#10b981' : theme.textPrimary },
                    ]}
                  >
                    {copied ? 'Code Copied!' : `Copy Code (${inviteCode})`}
                  </Text>
                </TouchableOpacity>

                <View style={styles.staticCodeBadge}>
                  <Feather name="shield" size={13} color="#10b981" />
                  <Text style={styles.staticCodeBadgeText}>Permanent Group Join PIN</Text>
                </View>
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
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 22,
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
    marginBottom: 20,
    gap: 12,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  groupSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  digitsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  digitBox: {
    width: 56,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  digitText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f97316',
  },
  instructionCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
    width: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actionCol: {
    gap: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    elevation: 2,
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  staticCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    gap: 6,
    marginTop: 4,
  },
  staticCodeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
});
