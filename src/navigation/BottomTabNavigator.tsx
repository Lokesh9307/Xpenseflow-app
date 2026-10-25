import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  Pressable,
  Keyboard,
  useWindowDimensions,
  Animated,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useFeature, FeatureMode } from '../context/FeatureContext';
import { api } from '../services/api';
import { dataEvents } from '../services/dataEvents';
import Svg, { Path } from 'react-native-svg';

// Screens
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ExpensesScreen } from '../screens/expenses/ExpensesScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { RecurringScreen } from '../screens/recurring/RecurringScreen';
import { SplitsScreen } from '../screens/splits/SplitsScreen';
import { SplitTransactionsScreen } from '../screens/splits/SplitTransactionsScreen';
import { TiffinScreen } from '../screens/tiffin/TiffinScreen';
import { TiffinTransactionsScreen } from '../screens/tiffin/TiffinTransactionsScreen';
import { ChatbotScreen } from '../screens/chatbot/ChatbotScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ExpenseTrackerSettingsScreen } from '../screens/settings/ExpenseTrackerSettingsScreen';
import { TiffinSettingsScreen } from '../screens/settings/TiffinSettingsScreen';

// Modals
import { AddExpenseModal } from '../components/AddExpenseModal';
import { AddSplitModal } from '../components/AddSplitModal';
import { AddTiffinModal } from '../components/AddTiffinModal';

const Tab = createBottomTabNavigator();

// Dummy component for tabs that trigger actions/modals via listeners
const NullComponent = () => <View style={{ flex: 1 }} />;

// ── Symmetrical Vector Notch Generator for 50dp Floating Button ──────────────
const getNotchPath = (w: number, h: number) => {
  const cx = w / 2;
  const leftStart = cx - 38;
  const leftMid = cx - 23;
  const bottom = cx;
  const rightMid = cx + 23;
  const rightEnd = cx + 38;

  const d = [
    `M 0,0`,
    `L ${leftStart},0`,
    `C ${leftStart + 6},0 ${leftMid - 4},5 ${leftMid},12`,
    `C ${leftMid + 6},22 ${bottom - 13},34 ${bottom},34`,
    `C ${bottom + 13},34 ${rightMid - 6},22 ${rightMid},12`,
    `C ${rightMid + 4},5 ${rightEnd - 6},0 ${rightEnd},0`,
    `L ${w},0`,
    `L ${w},${h}`,
    `L 0,${h}`,
    `Z`,
  ].join(' ');

  const strokeD = [
    `M 0,0`,
    `L ${leftStart},0`,
    `C ${leftStart + 6},0 ${leftMid - 4},5 ${leftMid},12`,
    `C ${leftMid + 6},22 ${bottom - 13},34 ${bottom},34`,
    `C ${bottom + 13},34 ${rightMid - 6},22 ${rightMid},12`,
    `C ${rightMid + 4},5 ${rightEnd - 6},0 ${rightEnd},0`,
    `L ${w},0`,
  ].join(' ');

  return { d, strokeD };
};

// ── Smooth Animated Tab Item with Spring Elevation & Blooming Pill ───────────
const AnimatedTabItem: React.FC<{
  route: any;
  index: number;
  isFocused: boolean;
  options: any;
  accentColor: string;
  bgTint: string;
  inactiveColor: string;
  onPress: () => void;
  onLongPress: () => void;
}> = ({
  route,
  isFocused,
  options,
  accentColor,
  bgTint,
  inactiveColor,
  onPress,
  onLongPress,
}) => {
  const anim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isFocused ? 1 : 0,
      friction: 7,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2.5],
  });

  const pillScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  const pillOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const label =
    options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
      ? options.title
      : route.name;

  return (
    <Pressable
      key={route.key}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel || String(label)}
      testID={options.tabBarButtonTestID}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.navItemBtn}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View
        style={[
          styles.navIconBubble,
          {
            transform: [{ scale }, { translateY }],
          },
        ]}
      >
        {/* Animated Background Circle */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: bgTint,
              borderRadius: 17,
              opacity: pillOpacity,
              transform: [{ scale: pillScale }],
            },
          ]}
        />
        {options.tabBarIcon?.({
          focused: isFocused,
          color: isFocused ? accentColor : inactiveColor,
          size: 20,
        })}
      </Animated.View>
      <Animated.Text
        style={[
          styles.navLabelText,
          {
            color: isFocused ? accentColor : inactiveColor,
            fontWeight: isFocused ? '700' : '600',
            transform: [{ translateY }],
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {String(label)}
      </Animated.Text>
    </Pressable>
  );
};

// ── Compact Floating Action Button with Reactive Spring Scale ────────────────
const FloatingAddButton: React.FC<{
  layoutWidth: number;
  accentColor: string;
  onPress: () => void;
}> = ({ layoutWidth, accentColor, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add Action Button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.floatingNotchFab,
        {
          left: layoutWidth / 2 - 25,
          backgroundColor: accentColor,
          shadowColor: accentColor,
        },
      ]}
      hitSlop={{ top: 12, bottom: 10, left: 12, right: 12 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="plus" size={24} color="#ffffff" />
      </Animated.View>
    </Pressable>
  );
};

interface CustomTabBarProps extends BottomTabBarProps {
  currentMode: FeatureMode;
  accentColor: string;
  bgTint: string;
  onOpenTiffinAdd: () => void;
  onOpenSplitCreate: () => void;
  onOpenExpenseAdd: () => void;
}

const CustomBottomTabBar: React.FC<CustomTabBarProps> = ({
  state,
  descriptors,
  navigation,
  insets,
  currentMode,
  accentColor,
  bgTint,
  onOpenTiffinAdd,
  onOpenSplitCreate,
  onOpenExpenseAdd,
}) => {
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(windowWidth);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

  if (isKeyboardVisible) {
    return null;
  }

  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
  const BAR_BODY_HEIGHT = 68;
  const TOTAL_BAR_HEIGHT = BAR_BODY_HEIGHT + safeBottom;

  const surfaceBg = isDark ? (theme.bgSurface || '#141218') : '#ffffff';
  const borderLineColor = isDark ? '#262230' : theme.borderSubtle;
  const inactiveColor = isDark ? '#94a3b8' : '#64748b';

  const renderTabItem = (route: any, index: number) => {
    const isFocused = state.index === index;
    const { options } = descriptors[route.key];

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    return (
      <AnimatedTabItem
        key={route.key}
        route={route}
        index={index}
        isFocused={isFocused}
        options={options}
        accentColor={accentColor}
        bgTint={bgTint}
        inactiveColor={inactiveColor}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
  };

  const handleFabPress = () => {
    if (currentMode === 'tiffin') {
      onOpenTiffinAdd();
    } else if (currentMode === 'split') {
      onOpenSplitCreate();
    } else {
      onOpenExpenseAdd();
    }
  };

  const { d, strokeD } = getNotchPath(layoutWidth, TOTAL_BAR_HEIGHT);

  return (
    <View
      style={[
        styles.customBarWrapper,
        {
          height: TOTAL_BAR_HEIGHT,
          shadowOpacity: isDark ? 0.35 : 0.08,
        },
      ]}
      onLayout={(e) => {
        const newW = e.nativeEvent.layout.width;
        if (newW && newW !== layoutWidth) {
          setLayoutWidth(newW);
        }
      }}
      pointerEvents="box-none"
    >
      {/* Background Symmetrical Notched Vector Canvas */}
      <Svg
        width={layoutWidth}
        height={TOTAL_BAR_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <Path d={d} fill={surfaceBg} />
        <Path
          d={strokeD}
          fill="none"
          stroke={borderLineColor}
          strokeWidth={1}
        />
      </Svg>

      {/* Center Floating Action Button (FAB) - Compact 50dp */}
      <FloatingAddButton
        layoutWidth={layoutWidth}
        accentColor={accentColor}
        onPress={handleFabPress}
      />

      {/* Navigation Items Row: 7 equidistant slots (3 left + 1 center FAB slot + 3 right) */}
      <View style={[styles.tiffinItemsRow, { height: BAR_BODY_HEIGHT }]}>
        <View style={styles.tiffinSlotCol}>
          {state.routes[0] && renderTabItem(state.routes[0], 0)}
        </View>
        <View style={styles.tiffinSlotCol}>
          {state.routes[1] && renderTabItem(state.routes[1], 1)}
        </View>
        <View style={styles.tiffinSlotCol}>
          {state.routes[2] && renderTabItem(state.routes[2], 2)}
        </View>

        {/* Reserved Center Notch Slot where Add Button floats */}
        <View style={styles.tiffinSlotCol} pointerEvents="none" />

        <View style={styles.tiffinSlotCol}>
          {state.routes[3] && renderTabItem(state.routes[3], 3)}
        </View>
        <View style={styles.tiffinSlotCol}>
          {state.routes[4] && renderTabItem(state.routes[4], 4)}
        </View>
        <View style={styles.tiffinSlotCol}>
          {state.routes[5] && renderTabItem(state.routes[5], 5)}
        </View>
      </View>
    </View>
  );
};

export const BottomTabNavigator = ({ navigation }: any) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeFeature, setActiveFeature } = useFeature();

  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10);

  const currentMode = activeFeature || 'expense';

  // State for More popover action sheet
  const [moreModalVisible, setMoreModalVisible] = useState(false);

  // State for Quick New action sheets (Split)
  const [splitNewSheetVisible, setSplitNewSheetVisible] = useState(false);

  // Direct modal controls
  const [addExpenseModalVisible, setAddExpenseModalVisible] = useState(false);
  const [addSplitModalVisible, setAddSplitModalVisible] = useState(false);

  // Quick group creation modals
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [createGroupType, setCreateGroupType] = useState<'tiffin' | 'split'>('tiffin');
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for the new group');
      return;
    }
    setCreatingGroup(true);
    try {
      if (createGroupType === 'tiffin') {
        await api.createTiffinGroup({ name: newGroupName.trim(), defaultPrice: 80 });
      } else {
        await api.createSplitGroup({ name: newGroupName.trim() });
      }
      setNewGroupName('');
      setCreateGroupModalVisible(false);
      Alert.alert('Success', 'Group created successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Direct Join Tiffin Group modal state & handler
  const [joinTiffinModalVisible, setJoinTiffinModalVisible] = useState(false);
  const [tiffinJoinCode, setTiffinJoinCode] = useState('');
  const [joiningTiffin, setJoiningTiffin] = useState(false);

  const handleJoinTiffinByCode = async () => {
    if (!tiffinJoinCode || tiffinJoinCode.trim().length !== 4) {
      Alert.alert('Invalid Code', 'Please enter a 4-digit invite code');
      return;
    }
    setJoiningTiffin(true);
    try {
      const res = await api.joinTiffinGroupByCode(tiffinJoinCode.trim());
      if (res.error) {
        Alert.alert('Join Failed', res.error);
      } else {
        setJoinTiffinModalVisible(false);
        setTiffinJoinCode('');
        Alert.alert('Success!', res.data?.message || 'You have joined the Tiffin Group!');
        dataEvents.emit('refresh_tiffin_data');
        dataEvents.emit('group_created');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to join group');
    } finally {
      setJoiningTiffin(false);
    }
  };

  const getFeatureAccent = () => {
    switch (currentMode) {
      case 'tiffin':
        return {
          accentColor: '#ea580c',
          bgTint: 'rgba(234, 88, 12, 0.16)',
          glow: 'rgba(234, 88, 12, 0.35)',
        };
      case 'split':
        return {
          accentColor: '#0284c7',
          bgTint: 'rgba(2, 132, 199, 0.16)',
          glow: 'rgba(2, 132, 199, 0.35)',
        };
      case 'expense':
      default:
        return {
          accentColor: '#0D9488',
          bgTint: 'rgba(13, 148, 136, 0.16)',
          glow: 'rgba(13, 148, 136, 0.35)',
        };
    }
  };

  const { accentColor, bgTint } = getFeatureAccent();

  // ── Render Dynamic Feature Bottom Tabs ─────────────────────────────────────────
  const renderTabs = () => {
    switch (currentMode) {
      // ══════════════════════════════════════════════════════════════════════════
      // 1. TIFFIN TRACKER MODE: [Tiffin, Txns, New Group (+), Join Group, Settings]
      // ══════════════════════════════════════════════════════════════════════════
      case 'tiffin':
        return (
          <>
            <Tab.Screen
              name="TiffinHome"
              component={TiffinScreen}
              options={{
                tabBarLabel: 'Tiffin',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons
                      name="silverware-fork-knife"
                      size={20}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="TiffinTxns"
              component={TiffinTransactionsScreen}
              options={{
                tabBarLabel: 'Txns',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'receipt' : 'receipt-outline'}
                      size={20}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="TiffinCopilot"
              component={ChatbotScreen}
              options={{
                tabBarLabel: 'Copilot',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'sparkles' : 'sparkles-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="TiffinJoinGroup"
              component={NullComponent}
              listeners={{
                tabPress: (e) => {
                  e.preventDefault();
                  setJoinTiffinModalVisible(true);
                },
              }}
              options={{
                tabBarLabel: 'Join Group',
                tabBarIcon: ({ color }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name="people-outline"
                      size={20}
                      color={color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="TiffinSettings"
              component={TiffinSettingsScreen}
              options={{
                tabBarLabel: 'Settings',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'settings' : 'settings-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="TiffinMore"
              component={NullComponent}
              listeners={{
                tabPress: (e) => {
                  e.preventDefault();
                  setMoreModalVisible(true);
                },
              }}
              options={{
                tabBarLabel: 'More',
                tabBarIcon: ({ color }) => (
                  <View style={styles.iconBox}>
                    <Ionicons name="ellipsis-horizontal" size={19} color={color} />
                  </View>
                ),
              }}
            />
          </>
        );

      // ══════════════════════════════════════════════════════════════════════════
      // 2. SPLIT BILLS MODE: [Groups, History, Copilot, (+), New Group, Profile, More]
      // ══════════════════════════════════════════════════════════════════════════
      case 'split':
        return (
          <>
            <Tab.Screen
              name="SplitGroups"
              component={SplitsScreen}
              options={{
                tabBarLabel: 'Groups',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'people' : 'people-outline'}
                      size={20}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="SplitHistory"
              component={SplitTransactionsScreen}
              options={{
                tabBarLabel: 'History',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'receipt' : 'receipt-outline'}
                      size={20}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="SplitCopilot"
              component={ChatbotScreen}
              options={{
                tabBarLabel: 'Copilot',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'sparkles' : 'sparkles-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="SplitNewGroup"
              component={NullComponent}
              listeners={{
                tabPress: (e) => {
                  e.preventDefault();
                  setCreateGroupType('split');
                  setCreateGroupModalVisible(true);
                },
              }}
              options={{
                tabBarLabel: 'New Group',
                tabBarIcon: ({ color }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name="person-add-outline"
                      size={19}
                      color={color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="SplitProfile"
              component={ProfileScreen}
              options={{
                tabBarLabel: 'Profile',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'person' : 'person-outline'}
                      size={20}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="SplitMore"
              component={NullComponent}
              listeners={{
                tabPress: (e) => {
                  e.preventDefault();
                  setMoreModalVisible(true);
                },
              }}
              options={{
                tabBarLabel: 'More',
                tabBarIcon: ({ color }) => (
                  <View style={styles.iconBox}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={color} />
                  </View>
                ),
              }}
            />
          </>
        );

      // ══════════════════════════════════════════════════════════════════════════
      // 3. EXPENSE TRACKER MODE: [Home, Txns, Insights, (+), Recurring, Settings, More]
      // ══════════════════════════════════════════════════════════════════════════
      case 'expense':
      default:
        return (
          <>
            <Tab.Screen
              name="ExpensesDashboard"
              component={DashboardScreen}
              options={{
                tabBarLabel: 'Home',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'home' : 'home-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="ExpensesTxns"
              component={ExpensesScreen}
              options={{
                tabBarLabel: 'Txns',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'receipt' : 'receipt-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="ExpensesCopilot"
              component={ChatbotScreen}
              options={{
                tabBarLabel: 'Copilot',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'sparkles' : 'sparkles-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="ExpensesRecurring"
              component={RecurringScreen}
              options={{
                tabBarLabel: 'Recurring',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'repeat' : 'repeat-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="ExpensesSettings"
              component={ExpenseTrackerSettingsScreen}
              options={{
                tabBarLabel: 'Settings',
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={focused ? 'settings' : 'settings-outline'}
                      size={19}
                      color={focused ? accentColor : color}
                    />
                  </View>
                ),
              }}
            />

            <Tab.Screen
              name="ExpensesMore"
              component={NullComponent}
              listeners={{
                tabPress: (e) => {
                  e.preventDefault();
                  setMoreModalVisible(true);
                },
              }}
              options={{
                tabBarLabel: 'More',
                tabBarIcon: ({ color }) => (
                  <View style={styles.iconBox}>
                    <Ionicons name="ellipsis-horizontal" size={19} color={color} />
                  </View>
                ),
              }}
            />
          </>
        );
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        key={`tab-navigator-${currentMode}-v4`}
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <CustomBottomTabBar
            {...props}
            currentMode={currentMode}
            accentColor={accentColor}
            bgTint={bgTint}
            onOpenTiffinAdd={() => {
              try {
                navigation?.navigate('MainTabs', { screen: 'TiffinHome' });
              } catch (_) {}
              dataEvents.emit('open_tiffin_add_modal');
            }}
            onOpenSplitCreate={() => setSplitNewSheetVisible(true)}
            onOpenExpenseAdd={() => setAddExpenseModalVisible(true)}
          />
        )}
      >
        {renderTabs()}
      </Tab.Navigator>

      {/* ── Apple-Style "⋯ More" Action Popover Sheet ───────────────────────── */}
      <Modal
        visible={moreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMoreModalVisible(false)}
        >
          <View
            style={[
              styles.moreSheet,
              {
                backgroundColor: isDark ? '#141416' : '#FFFFFF',
                borderColor: isDark ? '#26262B' : '#E2E8F0',
                paddingBottom: Math.max(safeBottom + 16, 28),
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Sheet Handle Indicator */}
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)' },
              ]}
            />

            {/* Header */}
            <View style={[styles.sheetHeaderRow, { borderBottomWidth: 1, borderBottomColor: isDark ? '#26262B' : '#E2E8F0', paddingBottom: 14 }]}>
              <View>
                <Text style={[styles.sheetSectionTitle, { color: theme.textMuted }]}>
                  WORKSPACES & TOOLS
                </Text>
                <Text style={[styles.sheetMainTitle, { color: theme.textPrimary }]}>
                  Feature Navigation
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setMoreModalVisible(false)}
                style={[styles.closeIconBtn, { backgroundColor: isDark ? '#1F1F24' : '#F1F5F9' }]}
              >
                <Feather name="x" size={18} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {/* 1. Feature Modules (Switch Workspace with 1 tap) */}
              <View style={styles.moduleSection}>
                <Text style={[styles.groupSubtitle, { color: theme.textMuted }]}>Switch Workspace</Text>

                {/* Expense Tracker Card */}
                <TouchableOpacity
                  style={[
                    styles.featureItemCard,
                    {
                      backgroundColor: currentMode === 'expense' ? (isDark ? 'rgba(13, 148, 136, 0.12)' : '#CCFBF1') : theme.bgSurface,
                      borderColor: currentMode === 'expense' ? '#0D9488' : (isDark ? '#26262B' : '#E2E8F0'),
                    },
                  ]}
                  onPress={async () => {
                    await setActiveFeature('expense');
                    setMoreModalVisible(false);
                  }}
                >
                  <View style={[styles.featureIconBubble, { backgroundColor: currentMode === 'expense' ? (isDark ? 'rgba(13, 148, 136, 0.25)' : '#99F6E4') : (isDark ? '#1F1F24' : '#F1F5F9') }]}>
                    <Ionicons name="wallet-outline" size={20} color={currentMode === 'expense' ? '#0D9488' : theme.textPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureCardTitle, { color: theme.textPrimary }]}>
                      Expense Tracker
                    </Text>
                    <Text style={[styles.featureCardDesc, { color: theme.textMuted }]}>
                      Personal budgets & AI analytics
                    </Text>
                  </View>
                  {currentMode === 'expense' ? (
                    <View style={[styles.activeBadge, { backgroundColor: '#0D9488' }]}>
                      <Ionicons name="checkmark" size={13} color="#ffffff" />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color={theme.textMuted} />
                  )}
                </TouchableOpacity>

                {/* Tiffin Tracker Card */}
                <TouchableOpacity
                  style={[
                    styles.featureItemCard,
                    {
                      backgroundColor: currentMode === 'tiffin' ? 'rgba(234, 88, 12, 0.12)' : theme.bgSurface,
                      borderColor: currentMode === 'tiffin' ? '#ea580c' : theme.borderSubtle,
                    },
                  ]}
                  onPress={async () => {
                    await setActiveFeature('tiffin');
                    setMoreModalVisible(false);
                  }}
                >
                  <View style={[styles.featureIconBubble, { backgroundColor: 'rgba(234, 88, 12, 0.2)' }]}>
                    <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#ea580c" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureCardTitle, { color: theme.textPrimary }]}>
                      Tiffin Tracker
                    </Text>
                    <Text style={[styles.featureCardDesc, { color: theme.textMuted }]}>
                      Meal logs & hostel ledger
                    </Text>
                  </View>
                  {currentMode === 'tiffin' ? (
                    <View style={[styles.activeBadge, { backgroundColor: '#ea580c' }]}>
                      <Ionicons name="checkmark" size={13} color="#ffffff" />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color={theme.textMuted} />
                  )}
                </TouchableOpacity>

                {/* Split Bills Card */}
                <TouchableOpacity
                  style={[
                    styles.featureItemCard,
                    {
                      backgroundColor: currentMode === 'split' ? 'rgba(2, 132, 199, 0.12)' : theme.bgSurface,
                      borderColor: currentMode === 'split' ? '#0284c7' : theme.borderSubtle,
                    },
                  ]}
                  onPress={async () => {
                    await setActiveFeature('split');
                    setMoreModalVisible(false);
                  }}
                >
                  <View style={[styles.featureIconBubble, { backgroundColor: 'rgba(2, 132, 199, 0.2)' }]}>
                    <Ionicons name="people-outline" size={20} color="#0284c7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureCardTitle, { color: theme.textPrimary }]}>
                      Split Bills
                    </Text>
                    <Text style={[styles.featureCardDesc, { color: theme.textMuted }]}>
                      Group expenses & fair settlements
                    </Text>
                  </View>
                  {currentMode === 'split' ? (
                    <View style={[styles.activeBadge, { backgroundColor: '#0284c7' }]}>
                      <Ionicons name="checkmark" size={13} color="#ffffff" />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color={theme.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              {/* 2. Direct Shortcuts & Tools */}
              <View style={styles.shortcutSection}>
                <Text style={[styles.groupSubtitle, { color: theme.textMuted }]}>Quick Shortcuts</Text>

                <View style={[styles.shortcutGrid, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
                  {/* AI Copilot */}
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => {
                      setMoreModalVisible(false);
                      navigation?.navigate('Chatbot');
                    }}
                  >
                    <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(13, 148, 136, 0.15)' }]}>
                      <Ionicons name="sparkles" size={18} color="#0D9488" />
                    </View>
                    <Text style={[styles.gridBtnText, { color: theme.textPrimary }]}>Copilot</Text>
                  </TouchableOpacity>

                  {/* Account / Profile */}
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => {
                      setMoreModalVisible(false);
                      navigation?.navigate('Profile');
                    }}
                  >
                    <View style={[styles.gridIconCircle, { backgroundColor: theme.bgElevated }]}>
                      <Ionicons name="settings-outline" size={18} color={theme.textPrimary} />
                    </View>
                    <Text style={[styles.gridBtnText, { color: theme.textPrimary }]}>Settings</Text>
                  </TouchableOpacity>

                  {/* Feature Portal Screen */}
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => {
                      setMoreModalVisible(false);
                      navigation?.navigate('FeaturePortal');
                    }}
                  >
                    <View style={[styles.gridIconCircle, { backgroundColor: theme.bgElevated }]}>
                      <Ionicons name="grid-outline" size={18} color={theme.textPrimary} />
                    </View>
                    <Text style={[styles.gridBtnText, { color: theme.textPrimary }]}>Portal</Text>
                  </TouchableOpacity>

                  {/* Dark/Light Mode */}
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => {
                      toggleTheme();
                    }}
                  >
                    <View style={[styles.gridIconCircle, { backgroundColor: theme.bgElevated }]}>
                      <Ionicons
                        name={isDark ? 'sunny-outline' : 'moon-outline'}
                        size={18}
                        color={accentColor}
                      />
                    </View>
                    <Text style={[styles.gridBtnText, { color: theme.textPrimary }]}>
                      {isDark ? 'Light' : 'Dark'}
                    </Text>
                  </TouchableOpacity>

                  {/* AI Copilot */}
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => {
                      setMoreModalVisible(false);
                      navigation?.navigate('Chatbot');
                    }}
                  >
                    <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
                      <Ionicons name="sparkles" size={18} color="#14b8a6" />
                    </View>
                    <Text style={[styles.gridBtnText, { color: theme.textPrimary }]}>Copilot</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>



      {/* ── Split "Create" Quick Action Sheet ───────────────────────────────── */}
      <Modal
        visible={splitNewSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSplitNewSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSplitNewSheetVisible(false)}
        >
          <View
            style={[
              styles.actionSheet,
              {
                backgroundColor: isDark ? '#141416' : '#FFFFFF',
                borderColor: isDark ? '#26262B' : '#E2E8F0',
                paddingBottom: Math.max(safeBottom + 16, 28),
              },
            ]}
          >
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)' },
              ]}
            />
            <Text style={[styles.actionSheetTitle, { color: theme.textPrimary }]}>Split Bills</Text>
            <Text style={[styles.actionSheetSub, { color: theme.textMuted }]}>
              Split an expense or create a group with friends
            </Text>

            <View style={{ gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.actionRowBtn, { backgroundColor: 'rgba(2, 132, 199, 0.12)', borderColor: '#0284c7' }]}
                onPress={() => {
                  setSplitNewSheetVisible(false);
                  setAddSplitModalVisible(true);
                }}
              >
                <Feather name="credit-card" size={22} color="#0284c7" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionRowTitle, { color: theme.textPrimary }]}>Add Split Bill</Text>
                  <Text style={[styles.actionRowSub, { color: theme.textMuted }]}>
                    Split restaurant, grocery or trip cost with members
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#0284c7" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionRowBtn, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}
                onPress={() => {
                  setSplitNewSheetVisible(false);
                  setCreateGroupType('split');
                  setCreateGroupModalVisible(true);
                }}
              >
                <Feather name="users" size={22} color={theme.textPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionRowTitle, { color: theme.textPrimary }]}>Create Split Group</Text>
                  <Text style={[styles.actionRowSub, { color: theme.textMuted }]}>
                    Create flatmates, trip or party group
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Create Group Modal (Shared for Tiffin & Split) ───────────────────── */}
      <Modal
        visible={createGroupModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.inputModalCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
            <Text style={[styles.actionSheetTitle, { color: theme.textPrimary }]}>
              Create {createGroupType === 'tiffin' ? 'Tiffin Group' : 'Split Group'}
            </Text>
            <Text style={[styles.actionSheetSub, { color: theme.textMuted }]}>
              Enter a name for your new group
            </Text>

            <TextInput
              style={[
                styles.modalTextInput,
                { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle, color: theme.textPrimary },
              ]}
              placeholder="e.g. Room 402 or Goa Trip"
              placeholderTextColor={theme.textMuted}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                onPress={() => {
                  setNewGroupName('');
                  setCreateGroupModalVisible(false);
                }}
                style={[styles.cancelBtn, { borderColor: theme.borderSubtle }]}
              >
                <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateGroup}
                disabled={creatingGroup}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: createGroupType === 'tiffin' ? '#ea580c' : '#0284c7' },
                ]}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                  {creatingGroup ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Tiffin Group with 4-Digit PIN Modal */}
      <Modal
        visible={joinTiffinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinTiffinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.inputModalCard,
              {
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              },
            ]}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(234, 88, 12, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Feather name="key" size={22} color="#ea580c" />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: theme.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Join Tiffin Group
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.textMuted,
                  textAlign: 'center',
                  marginTop: 4,
                  paddingHorizontal: 8,
                }}
              >
                Enter the 4-digit code shared by your friend to join
              </Text>
            </View>

            <TextInput
              style={[
                styles.modalTextInput,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.bgElevated,
                  borderColor: theme.borderSubtle,
                  textAlign: 'center',
                  fontSize: 24,
                  letterSpacing: 10,
                  fontWeight: '700',
                  height: 52,
                },
              ]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              value={tiffinJoinCode}
              onChangeText={setTiffinJoinCode}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                onPress={() => {
                  setTiffinJoinCode('');
                  setJoinTiffinModalVisible(false);
                }}
                style={[styles.cancelBtn, { borderColor: theme.borderSubtle }]}
              >
                <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleJoinTiffinByCode}
                disabled={joiningTiffin}
                style={[styles.confirmBtn, { backgroundColor: '#ea580c' }]}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                  {joiningTiffin ? 'Joining...' : 'Join Group'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Direct Global Modals */}
      <AddExpenseModal
        visible={addExpenseModalVisible}
        onClose={() => setAddExpenseModalVisible(false)}
        onSuccess={() => { }}
      />
      <AddSplitModal
        visible={addSplitModalVisible}
        onClose={() => setAddSplitModalVisible(false)}
        onSuccess={() => { }}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTabButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  centerCradleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  customBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 10,
    overflow: 'visible',
    zIndex: 9999,
  },
  floatingNotchFab: {
    position: 'absolute',
    top: -21,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 7,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  tiffinItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tiffinSlotCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  navItemBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  navIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  navLabelText: {
    fontSize: 9.5,
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  moreSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '82%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sheetMainTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleSection: {
    gap: 8,
  },
  groupSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  featureIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  featureCardDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  shortcutSection: {
    marginTop: 4,
  },
  shortcutGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  gridBtn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  gridIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  actionSheetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  actionRowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRowSub: {
    fontSize: 11,
    marginTop: 2,
  },
  inputModalCard: {
    margin: 20,
    marginBottom: 40,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  modalTextInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginTop: 14,
    marginBottom: 16,
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
});
