import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { navigateSafely } from '../../services/navigationRegistry';
import { IntentActionCard } from '../../components/copilot/IntentActionCard';
import { NavigationActionCard } from '../../components/copilot/NavigationActionCard';
import { ClarificationCard } from '../../components/copilot/ClarificationCard';
import { copilotChatStore, CopilotMessage } from '../../services/copilotChatStore';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  intent?: string;
  actionCard?: {
    type: 'expense_preview' | 'verified_result';
    data: any;
  } | null;
  navigationAction?: {
    screenId: string;
    title: string;
    description?: string;
    tab?: string;
  } | null;
  clarification?: {
    question: string;
    options: string[];
    missingField?: string;
  } | null;
  parsedForm?: any;
}

const QUICK_PROMPTS = [
  '⛽ Spent ₹400 on petrol',
  '☕ Spent ₹140 on Starbucks coffee',
  '🍱 Log lunch tiffin for today',
  '📊 How much did I spend this month?',
  '🎯 Which category is closest to budget?',
  '👥 Check my split expense balances',
  '🧭 Open spending analytics',
];

export const ChatbotScreen: React.FC<any> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const userId = user?.id || user?.email || 'guest';

  // Read immediately from RAM cache for 0ms render latency
  const [messages, setMessages] = useState<CopilotMessage[]>(() => copilotChatStore.getMessages());
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<'agentic' | 'simple'>('agentic');
  const [loading, setLoading] = useState(false);
  const [submittingMsgId, setSubmittingMsgId] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const scrollViewRef = useRef<any>(null);

  // Hydrate from local phone storage into RAM on user switch / mount
  useEffect(() => {
    let mounted = true;
    copilotChatStore.init(userId).then((storedMsgs) => {
      if (mounted) {
        setMessages(storedMsgs);
      }
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    setInputText('');

    const userMsg: CopilotMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // 0ms RAM update + async phone storage persist
    copilotChatStore.appendMessage(userMsg);
    setMessages([...copilotChatStore.getMessages()]);
    setLoading(true);

    const clientRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const res = await api.sendChatMessage({
      message: query,
      mode,
      requestId: clientRequestId,
      history: messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
    });

    setLoading(false);

    if (res.data) {
      const botResponse = res.data.response || res.data.reply || res.data.text || 'Got it!';
      const parsedForm = res.data.form || res.data.parsedExpense;
      const actionCard = res.data.actionCard || (parsedForm ? { type: 'expense_preview', data: parsedForm } : null);

      const assistantMsg: CopilotMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: botResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: res.data.intent,
        actionCard: actionCard ? { ...actionCard, data: { ...actionCard.data, isComplete: true } } : null,
        navigationAction: res.data.navigationAction,
        clarification: res.data.clarification,
        parsedForm: parsedForm ? { ...parsedForm, isComplete: true } : undefined,
      };

      copilotChatStore.appendMessage(assistantMsg);
      setMessages([...copilotChatStore.getMessages()]);
    } else {
      // Offline fallback
      const fallbackMsg: CopilotMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: "I couldn't reach the server. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      copilotChatStore.appendMessage(fallbackMsg);
      setMessages([...copilotChatStore.getMessages()]);
    }
  };

  const handleConfirmSaveExpense = async (msgId: string, form: any) => {
    if (!form.amount || !form.category || submittingMsgId) return;

    setSubmittingMsgId(msgId);

    // Call api.addExpense to perform verified DB write and emit instant local dataEvents
    const res = await api.addExpense({
      title: form.title || `${form.category} expense`,
      amount: form.amount,
      category: form.category,
      categoryId: form.categoryId,
      paymentMethod: form.paymentMethod || 'UPI',
      date: form.date || new Date().toISOString(),
    });

    setSubmittingMsgId(null);

    if (res.error) {
      Alert.alert('Save Failed', res.error);
    } else {
      Alert.alert('Expense Verified & Saved! 🎉', `₹${form.amount} recorded under ${form.category}`);
      copilotChatStore.updateMessage(msgId, {
        parsedForm: { ...form, saved: true },
        actionCard: { type: 'verified_result', data: { ...form, saved: true } },
      });
      setMessages([...copilotChatStore.getMessages()]);
    }
  };

  const handleCancelAction = (msgId: string) => {
    copilotChatStore.updateMessage(msgId, { actionCard: null, parsedForm: undefined });
    setMessages([...copilotChatStore.getMessages()]);
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History?',
      'This clears your chat messages stored on this device. Recorded transactions in your account will not be changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await copilotChatStore.clearChat();
            setMessages(copilotChatStore.getMessages());
          },
        },
      ]
    );
  };

  const handleNavigationAction = (screenId: string) => {
    const success = navigateSafely(navigation, screenId);
    if (!success) {
      Alert.alert('Navigation Notice', `Could not open screen: ${screenId}`);
    }
  };

  const dynamicTop = Math.max(insets.top + 6, 16);

  // Tab bar clearance calculation when rendered inside bottom navigation tabs
  const isTabBarActive = route?.name?.includes('Copilot') || Boolean(navigation?.getParent?.());
  const safeBottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
  const bottomTabBarHeight = 68 + safeBottomInset;

  const dynamicBottomPadding = isKeyboardVisible
    ? Math.max(insets.bottom, 12)
    : isTabBarActive
    ? bottomTabBarHeight + 10
    : Math.max(insets.bottom, 14);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      style={[styles.container, { backgroundColor: theme.bgApp }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: dynamicTop,
            backgroundColor: theme.bgSurface,
            borderBottomColor: theme.borderSubtle,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.botAvatar, { backgroundColor: theme.accentPrimarySubtle }]}>
            <Ionicons name="sparkles" size={20} color={theme.accentPrimary} />
          </View>
          <View>
            <Text style={[styles.botName, { color: theme.textPrimary }]}>ExpenseBot AI</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.statusText, { color: theme.textMuted }]}>
                Production Copilot · Ready
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {/* Smart Mode Pill */}
          <TouchableOpacity
            style={[
              styles.modePill,
              {
                backgroundColor: theme.accentPrimarySubtle,
                borderColor: theme.accentPrimary,
              },
            ]}
            onPress={() => setMode(mode === 'agentic' ? 'simple' : 'agentic')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modePillText, { color: theme.accentPrimary }]}>
              {mode === 'agentic' ? '⚡ Tool-Driven' : '💬 Q&A'}
            </Text>
          </TouchableOpacity>

          {/* Clear Local Chat Button */}
          <TouchableOpacity
            style={[styles.clearChatBtn, { borderColor: theme.borderSubtle }]}
            onPress={handleClearChat}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesScroll}
        contentContainerStyle={[styles.messagesContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          const cardData = m.actionCard?.data || m.parsedForm;

          return (
            <View
              key={m.id}
              style={[
                styles.messageRow,
                isUser ? styles.userRow : styles.assistantRow,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? [styles.userBubble, { backgroundColor: theme.accentPrimary }]
                    : [styles.assistantBubble, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }],
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    { color: isUser ? '#ffffff' : theme.textPrimary },
                  ]}
                >
                  {m.text}
                </Text>

                {/* 1. Structured Expense Action Card */}
                {cardData && cardData.amount > 0 && (
                  <IntentActionCard
                    cardData={cardData}
                    onConfirm={() => handleConfirmSaveExpense(m.id, cardData)}
                    onCancel={() => handleCancelAction(m.id)}
                    isSubmitting={submittingMsgId === m.id}
                    theme={theme}
                  />
                )}

                {/* 2. Structured Navigation Card */}
                {m.navigationAction && (
                  <NavigationActionCard
                    navigationAction={m.navigationAction}
                    onNavigate={handleNavigationAction}
                    theme={theme}
                  />
                )}

                {/* 3. Clarification Quick Reply Chips */}
                {m.clarification && (
                  <ClarificationCard
                    clarification={m.clarification}
                    onSelectOption={(opt) => handleSend(opt)}
                    theme={theme}
                  />
                )}

                <Text
                  style={[
                    styles.timestampText,
                    { color: isUser ? 'rgba(255,255,255,0.7)' : theme.textMuted },
                  ]}
                >
                  {m.timestamp}
                </Text>
              </View>
            </View>
          );
        })}



        {loading && (
          <View style={styles.loadingBubble}>
            <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={theme.accentPrimary} />
                <Text style={[styles.typingText, { color: theme.textMuted }]}>
                  ExpenseBot is thinking...
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Prompts Carousel */}
      <View style={styles.promptsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptsScroll}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.promptPill,
                { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
              ]}
              onPress={() => handleSend(prompt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.promptText, { color: theme.textPrimary }]}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.bgSurface,
            borderTopColor: theme.borderSubtle,
            paddingBottom: dynamicBottomPadding,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bgElevated,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary,
            },
          ]}
          placeholder="Ask ExpenseBot or describe an expense..."
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: inputText.trim() ? theme.accentPrimary : theme.bgElevated,
            },
          ]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || loading}
          activeOpacity={0.8}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() ? '#ffffff' : theme.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearChatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  timestampText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  actionCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  actionAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  actionDetails: {
    marginBottom: 10,
    gap: 2,
  },
  actionMeta: {
    fontSize: 12,
  },
  confirmBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  savedBadge: {
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBubble: {
    alignItems: 'flex-start',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  promptsContainer: {
    paddingVertical: 8,
  },
  promptsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  promptPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  promptText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatbotScreen;
