import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { dataEvents } from '../services/dataEvents';
import { Category3DIcon } from './Category3DIcon';

interface CategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCategory?: any; // If provided, edit mode
}

export interface CategoryIconItem {
  key: string;
  label: string;
  category: '3D' | 'Food' | 'Shop' | 'Travel' | 'Bills' | 'Health' | 'Fun' | 'Finance' | 'Life';
  is3D?: boolean;
  keywords?: string[];
}

export const ALL_CATEGORY_ICONS: CategoryIconItem[] = [
  // ── Signature 3D Claymorphic Icons ──
  { key: 'Food & Dining', label: 'Food', category: '3D', is3D: true, keywords: ['food', 'burger', 'dining', 'restaurant', 'cafe', 'eat', 'meal', 'lunch', 'dinner'] },
  { key: 'Shopping', label: 'Shopping', category: '3D', is3D: true, keywords: ['shop', 'cart', 'buy', 'cloth', 'bag', 'store', 'mall', 'fashion'] },
  { key: 'Groceries', label: 'Groceries', category: '3D', is3D: true, keywords: ['groc', 'vegetable', 'fruit', 'market', 'daily', 'supermarket', 'milk', 'egg'] },
  { key: 'Travel & Commute', label: 'Travel', category: '3D', is3D: true, keywords: ['travel', 'car', 'fuel', 'cab', 'uber', 'ola', 'commute', 'petrol', 'diesel'] },
  { key: 'Bills & Utilities', label: 'Bills', category: '3D', is3D: true, keywords: ['bill', 'util', 'electric', 'light', 'current', 'power', 'recharge', 'wifi'] },
  { key: 'Entertainment', label: 'Fun', category: '3D', is3D: true, keywords: ['entertain', 'movie', 'cinema', 'fun', 'game', 'netflix', 'ott', 'show', 'party'] },
  { key: 'Health & Fitness', label: 'Health', category: '3D', is3D: true, keywords: ['health', 'fit', 'gym', 'medic', 'doctor', 'hospital', 'pharma', 'pill'] },
  { key: 'Education', label: 'Education', category: '3D', is3D: true, keywords: ['edu', 'school', 'college', 'book', 'course', 'study', 'class', 'tuition', 'fee'] },
  { key: 'Investment', label: 'Investment', category: '3D', is3D: true, keywords: ['invest', 'stock', 'share', 'gold', 'crypto', 'sip', 'mutual', 'fund', 'wealth'] },
  { key: 'Tiffin & Meals', label: 'Tiffin', category: '3D', is3D: true, keywords: ['tiffin', 'dabba', 'meal', 'lunchbox', 'cater', 'mess'] },
  { key: 'Split & Groups', label: 'Split', category: '3D', is3D: true, keywords: ['split', 'group', 'share', 'roommate', 'friend', 'trip'] },
  { key: 'Others', label: 'Others', category: '3D', is3D: true, keywords: ['other', 'misc', 'general', 'cube', 'extra'] },

  // ── Food & Drinks ──
  { key: 'restaurant-outline', label: 'Dining', category: 'Food', keywords: ['restaurant', 'dining', 'food', 'fork', 'knife'] },
  { key: 'pizza-outline', label: 'Pizza', category: 'Food', keywords: ['pizza', 'fast food', 'snack', 'junk'] },
  { key: 'cafe-outline', label: 'Coffee', category: 'Food', keywords: ['coffee', 'tea', 'cafe', 'starbucks', 'beverage'] },
  { key: 'beer-outline', label: 'Drinks', category: 'Food', keywords: ['beer', 'bar', 'alcohol', 'pub', 'party'] },
  { key: 'wine-outline', label: 'Wine', category: 'Food', keywords: ['wine', 'cocktail', 'club', 'celebration'] },
  { key: 'ice-cream-outline', label: 'Dessert', category: 'Food', keywords: ['ice cream', 'sweet', 'dessert', 'bakery', 'cake'] },
  { key: 'nutrition-outline', label: 'Nutrition', category: 'Food', keywords: ['nutrition', 'healthy', 'diet', 'organic', 'vegan'] },

  // ── Shopping & Retail ──
  { key: 'cart-outline', label: 'Cart', category: 'Shop', keywords: ['cart', 'shopping', 'store', 'checkout'] },
  { key: 'bag-handle-outline', label: 'Bags', category: 'Shop', keywords: ['bag', 'handbag', 'mall', 'shopping'] },
  { key: 'shirt-outline', label: 'Clothing', category: 'Shop', keywords: ['shirt', 'cloth', 'wear', 'apparel', 'outfit', 'zara', 'h&m'] },
  { key: 'watch-outline', label: 'Watch', category: 'Shop', keywords: ['watch', 'accessory', 'jewelry', 'clock'] },
  { key: 'gift-outline', label: 'Gift', category: 'Shop', keywords: ['gift', 'present', 'birthday', 'festival', 'surprise'] },
  { key: 'diamond-outline', label: 'Luxury', category: 'Shop', keywords: ['diamond', 'jewelry', 'gold', 'expensive', 'gem'] },
  { key: 'pricetag-outline', label: 'Deals', category: 'Shop', keywords: ['discount', 'deal', 'offer', 'sale', 'coupon'] },

  // ── Travel & Commute ──
  { key: 'car-outline', label: 'Car', category: 'Travel', keywords: ['car', 'driving', 'auto', 'vehicle', 'taxi'] },
  { key: 'car-sport-outline', label: 'Ride', category: 'Travel', keywords: ['sport', 'speed', 'rental', 'cab'] },
  { key: 'airplane-outline', label: 'Flight', category: 'Travel', keywords: ['flight', 'airplane', 'travel', 'vacation', 'holiday', 'trip'] },
  { key: 'bus-outline', label: 'Bus', category: 'Travel', keywords: ['bus', 'transit', 'public transport'] },
  { key: 'subway-outline', label: 'Metro', category: 'Travel', keywords: ['metro', 'train', 'subway', 'railway'] },
  { key: 'bicycle-outline', label: 'Bicycle', category: 'Travel', keywords: ['bike', 'bicycle', 'cycle', 'two wheeler'] },
  { key: 'speedometer-outline', label: 'Fuel', category: 'Travel', keywords: ['fuel', 'petrol', 'gas', 'diesel', 'cng'] },
  { key: 'map-outline', label: 'Explore', category: 'Travel', keywords: ['map', 'tour', 'roadtrip', 'navigate'] },

  // ── Bills & Home Utilities ──
  { key: 'flash-outline', label: 'Electric', category: 'Bills', keywords: ['electricity', 'power', 'current', 'light'] },
  { key: 'wifi-outline', label: 'Internet', category: 'Bills', keywords: ['wifi', 'broadband', 'internet', 'fiber', 'net'] },
  { key: 'water-outline', label: 'Water', category: 'Bills', keywords: ['water', 'tap', 'cooler', 'bill'] },
  { key: 'flame-outline', label: 'Gas', category: 'Bills', keywords: ['gas', 'cylinder', 'heating', 'stove'] },
  { key: 'phone-portrait-outline', label: 'Mobile', category: 'Bills', keywords: ['mobile', 'phone', 'recharge', 'sim', 'airtel', 'jio'] },
  { key: 'tv-outline', label: 'TV/DTH', category: 'Bills', keywords: ['tv', 'dth', 'cable', 'television'] },
  { key: 'home-outline', label: 'Rent', category: 'Bills', keywords: ['rent', 'house', 'apartment', 'flat', 'stay'] },
  { key: 'construct-outline', label: 'Repair', category: 'Bills', keywords: ['repair', 'plumber', 'electrician', 'hardware', 'fix'] },

  // ── Entertainment & Leisure ──
  { key: 'film-outline', label: 'Cinema', category: 'Fun', keywords: ['movie', 'film', 'cinema', 'theater', 'netflix', 'prime'] },
  { key: 'game-controller-outline', label: 'Gaming', category: 'Fun', keywords: ['game', 'playstation', 'xbox', 'steam', 'pc'] },
  { key: 'musical-notes-outline', label: 'Music', category: 'Fun', keywords: ['music', 'song', 'spotify', 'concert'] },
  { key: 'ticket-outline', label: 'Events', category: 'Fun', keywords: ['ticket', 'event', 'concert', 'show', 'stadium'] },
  { key: 'camera-outline', label: 'Camera', category: 'Fun', keywords: ['photo', 'camera', 'shoot', 'video'] },
  { key: 'color-palette-outline', label: 'Hobby', category: 'Fun', keywords: ['art', 'paint', 'hobby', 'creative'] },

  // ── Health & Wellness ──
  { key: 'fitness-outline', label: 'Fitness', category: 'Health', keywords: ['fitness', 'workout', 'yoga', 'cardio'] },
  { key: 'barbell-outline', label: 'Gym', category: 'Health', keywords: ['gym', 'weights', 'exercise', 'trainer'] },
  { key: 'medkit-outline', label: 'Pharma', category: 'Health', keywords: ['medicine', 'pharmacy', 'chemist', 'drugs'] },
  { key: 'heart-outline', label: 'Doctor', category: 'Health', keywords: ['heart', 'doctor', 'clinic', 'checkup', 'hospital'] },
  { key: 'bandage-outline', label: 'Care', category: 'Health', keywords: ['first aid', 'bandage', 'wound', 'injury'] },
  { key: 'pulse-outline', label: 'Diagnostics', category: 'Health', keywords: ['lab', 'test', 'blood', 'scan'] },

  // ── Finance & Money ──
  { key: 'wallet-outline', label: 'Wallet', category: 'Finance', keywords: ['wallet', 'cash', 'purse', 'money'] },
  { key: 'card-outline', label: 'Cards', category: 'Finance', keywords: ['credit card', 'debit card', 'emi', 'swipe'] },
  { key: 'cash-outline', label: 'Cash', category: 'Finance', keywords: ['cash', 'currency', 'rupee', 'notes'] },
  { key: 'trending-up-outline', label: 'Stocks', category: 'Finance', keywords: ['stocks', 'share', 'grow', 'crypto', 'bitcoin'] },
  { key: 'shield-checkmark-outline', label: 'Insurance', category: 'Finance', keywords: ['insurance', 'policy', 'term', 'lic', 'secure'] },

  // ── Life, Work & Family ──
  { key: 'briefcase-outline', label: 'Work', category: 'Life', keywords: ['office', 'work', 'job', 'business', 'tax'] },
  { key: 'laptop-outline', label: 'Gadgets', category: 'Life', keywords: ['laptop', 'computer', 'apple', 'mac', 'electronics'] },
  { key: 'book-outline', label: 'Books', category: 'Life', keywords: ['book', 'read', 'library', 'stationery'] },
  { key: 'school-outline', label: 'School', category: 'Life', keywords: ['school', 'college', 'degree', 'exam'] },
  { key: 'people-outline', label: 'Family', category: 'Life', keywords: ['family', 'kids', 'parents', 'friends'] },
  { key: 'paw-outline', label: 'Pets', category: 'Life', keywords: ['pet', 'dog', 'cat', 'animal', 'vet'] },
  { key: 'flower-outline', label: 'Garden', category: 'Life', keywords: ['plants', 'flowers', 'garden', 'nature'] },
  { key: 'key-outline', label: 'Security', category: 'Life', keywords: ['key', 'lock', 'deposit', 'safety'] },
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialCategory,
}) => {
  const { isDark } = useTheme();

  const isEdit = Boolean(
    initialCategory && (initialCategory._id || initialCategory.id || initialCategory.name)
  );

  const resolveInitialIcon = (cat?: any): string => {
    if (!cat) return 'Food & Dining';
    if (cat.icon) {
      const match = ALL_CATEGORY_ICONS.find(
        (p) =>
          p.key.toLowerCase() === cat.icon.toLowerCase() ||
          cat.icon.toLowerCase().includes(p.label.toLowerCase())
      );
      if (match) return match.key;
      return cat.icon;
    }
    if (cat.name) {
      const match = ALL_CATEGORY_ICONS.find((p) =>
        cat.name.toLowerCase().includes(p.label.toLowerCase())
      );
      if (match) return match.key;
    }
    return 'Food & Dining';
  };

  const [name, setName] = useState(initialCategory?.name || '');
  // Budget limit is OPTIONAL — blank means "no budget for this category"
  const [monthlyLimit, setMonthlyLimit] = useState(
    initialCategory?.limit || initialCategory?.monthlyLimit
      ? String(initialCategory.limit || initialCategory.monthlyLimit)
      : ''
  );
  const [selectedIcon, setSelectedIcon] = useState(resolveInitialIcon(initialCategory));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterTab, setSelectedFilterTab] = useState<string>('All');
  const [loading, setLoading] = useState(false);

  // Sync state if initialCategory changes
  React.useEffect(() => {
    if (initialCategory) {
      setName(initialCategory.name || '');
      setMonthlyLimit(
        initialCategory.limit || initialCategory.monthlyLimit
          ? String(initialCategory.limit || initialCategory.monthlyLimit)
          : ''
      );
      setSelectedIcon(resolveInitialIcon(initialCategory));
    } else {
      setName('');
      setMonthlyLimit('');
      setSelectedIcon('Food & Dining');
    }
    setSearchQuery('');
    setSelectedFilterTab('All');
  }, [initialCategory, visible]);

  // Filtered icon list with search & category tabs
  const filteredIcons = useMemo(() => {
    let list = ALL_CATEGORY_ICONS;

    // Filter by tab
    if (selectedFilterTab === '3D') {
      list = list.filter((i) => i.is3D);
    } else if (selectedFilterTab !== 'All') {
      list = list.filter((i) => i.category === selectedFilterTab);
    }

    // Filter by search query
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;

    return list.filter((i) => {
      if (i.label.toLowerCase().includes(q)) return true;
      if (i.key.toLowerCase().includes(q)) return true;
      if (i.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [searchQuery, selectedFilterTab]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a category name');
      return;
    }

    // Budget is optional — only validate when the user typed something
    const trimmedLimit = monthlyLimit.trim();
    const limitNum = trimmedLimit === '' ? null : parseFloat(trimmedLimit);
    if (limitNum !== null && (isNaN(limitNum) || limitNum <= 0)) {
      Alert.alert('Invalid Limit', 'Enter a positive amount, or leave it blank for no budget');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        const id = initialCategory._id || initialCategory.id || '';
        const previousName = initialCategory.name || '';
        const res = await api.updateCategory(id, {
          name: name.trim(),
          limit: limitNum,
          monthlyLimit: limitNum,
          icon: selectedIcon,
          previousName,
        });

        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          const updatedPayload = {
            _id: id,
            id,
            name: name.trim(),
            limit: limitNum,
            monthlyLimit: limitNum,
            icon: selectedIcon,
            previousName,
          };
          dataEvents.emit('category_updated', res.data || updatedPayload);
          dataEvents.emit('refresh_data');
          onSuccess();
          onClose();
        }
      } else {
        const res = await api.createCategory({
          name: name.trim(),
          limit: limitNum,
          monthlyLimit: limitNum,
          icon: selectedIcon,
        });

        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          dataEvents.emit('category_updated', res.data);
          dataEvents.emit('refresh_data');
          onSuccess();
          onClose();
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!isEdit) return;
    const id = initialCategory._id || initialCategory.id || initialCategory.name;
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${initialCategory.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const res = await api.deleteCategory(id);
            setLoading(false);
            if (res.error) {
              Alert.alert('Error', res.error);
            } else {
              dataEvents.emit('category_deleted', id);
              dataEvents.emit('refresh_data');
              onSuccess();
              onClose();
            }
          },
        },
      ]
    );
  };

  const bgModal = isDark ? '#141416' : '#FFFFFF';
  const borderCol = isDark ? '#26262B' : '#E2E8F0';
  const textCol = isDark ? '#FFFFFF' : '#101012';
  const subText = isDark ? '#8E8E93' : '#6B7280';
  const inputBg = isDark ? '#1C1C20' : '#F1F5F9';
  const inputBorder = isDark ? '#2D2D35' : '#E2E8F0';
  const handleBg = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)';

  const filterTabs = [
    { id: 'All', label: 'All Icons' },
    { id: '3D', label: '3D Featured' },
    { id: 'Food', label: 'Food & Drink' },
    { id: 'Shop', label: 'Shopping' },
    { id: 'Travel', label: 'Travel' },
    { id: 'Bills', label: 'Bills & Utilities' },
    { id: 'Fun', label: 'Entertainment' },
    { id: 'Health', label: 'Health' },
    { id: 'Finance', label: 'Finance' },
    { id: 'Life', label: 'Life & Work' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: bgModal, borderColor: borderCol },
          ]}
        >
          {/* Sheet Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: handleBg }]} />

          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: borderCol }]}>
            <View>
              <Text style={[styles.modalTitle, { color: textCol }]}>
                {isEdit ? 'Edit Category Budget' : 'Add New Category'}
              </Text>
              <Text style={[styles.modalSub, { color: subText }]}>
                Configure allocation and search icons
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: inputBg }]}
            >
              <Feather name="x" size={18} color={textCol} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollBodyContent}
          >
            {/* Live Category Preview Card */}
            <View
              style={[
                styles.previewCard,
                { backgroundColor: inputBg, borderColor: inputBorder },
              ]}
            >
              <View style={styles.previewIconWrap}>
                <Category3DIcon category={name || selectedIcon} icon={selectedIcon} size={48} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewTitle, { color: textCol }]} numberOfLines={1}>
                  {name.trim() || selectedIcon}
                </Text>
                <Text style={[styles.previewSub, { color: subText }]}>
                  {monthlyLimit.trim() === '' ? 'No budget set' : `Limit: ₹${(parseFloat(monthlyLimit) || 0).toLocaleString()} / month`}
                </Text>
              </View>
              <View
                style={[
                  styles.previewTag,
                  {
                    backgroundColor: isDark
                      ? 'rgba(13, 148, 136, 0.16)'
                      : '#CCFBF1',
                    borderColor: isDark
                      ? 'rgba(13, 148, 136, 0.3)'
                      : '#99F6E4',
                  },
                ]}
              >
                <Text style={styles.previewTagText}>ACTIVE ICON</Text>
              </View>
            </View>

            {/* Input Fields */}
            <View style={styles.formSection}>
              <Text style={[styles.inputLabel, { color: subText }]}>CATEGORY NAME</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textCol },
                ]}
                placeholder="e.g. Dining, Shopping, Fitness"
                placeholderTextColor={subText}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.inputLabel, { color: subText }]}>
                MONTHLY BUDGET LIMIT (₹) — OPTIONAL
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textCol },
                ]}
                placeholder="Leave blank for no budget"
                placeholderTextColor={subText}
                keyboardType="numeric"
                value={monthlyLimit}
                onChangeText={setMonthlyLimit}
              />

              {/* ── COMPLETE ICON LIBRARY WITH SEARCH ── */}
              <View style={styles.iconSectionHeader}>
                <Text style={[styles.inputLabel, { color: subText }]}>
                  SELECT CATEGORY ICON ({filteredIcons.length})
                </Text>
                <Text style={[styles.selectedIconName, { color: '#0D9488' }]} numberOfLines={1}>
                  Selected: {selectedIcon}
                </Text>
              </View>

              {/* Live Search Bar for Icons */}
              <View
                style={[
                  styles.iconSearchBar,
                  { backgroundColor: inputBg, borderColor: inputBorder },
                ]}
              >
                <Feather name="search" size={15} color={subText} />
                <TextInput
                  style={[styles.iconSearchInput, { color: textCol }]}
                  placeholder="Search icons (e.g. pizza, coffee, car, flight, gym)..."
                  placeholderTextColor={subText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color={subText} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Tabs Scrollable Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterTabsRow}
              >
                {filterTabs.map((tab) => {
                  const isActive = selectedFilterTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      activeOpacity={0.7}
                      onPress={() => setSelectedFilterTab(tab.id)}
                      style={[
                        styles.filterTabPill,
                        {
                          backgroundColor: isActive ? '#0D9488' : inputBg,
                          borderColor: isActive ? '#0D9488' : inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterTabText,
                          { color: isActive ? '#FFFFFF' : subText, fontWeight: isActive ? '800' : '600' },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Responsive Icon Grid */}
              <View style={styles.icon3DGrid}>
                {filteredIcons.length === 0 ? (
                  <View style={styles.emptySearchBox}>
                    <Feather name="help-circle" size={24} color={subText} />
                    <Text style={[styles.emptySearchText, { color: subText }]}>
                      No icons match "{searchQuery}"
                    </Text>
                  </View>
                ) : (
                  filteredIcons.map((ic) => {
                    const isSelected =
                      selectedIcon.toLowerCase() === ic.key.toLowerCase() ||
                      selectedIcon.toLowerCase() === ic.label.toLowerCase();

                    return (
                      <TouchableOpacity
                        key={ic.key}
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedIcon(ic.key);
                          if (!name.trim()) {
                            setName(ic.label);
                          }
                        }}
                        style={[
                          styles.icon3DCard,
                          {
                            backgroundColor: isSelected
                              ? isDark
                                ? 'rgba(13, 148, 136, 0.16)'
                                : '#CCFBF1'
                              : inputBg,
                            borderColor: isSelected ? '#0D9488' : inputBorder,
                          },
                        ]}
                      >
                        <View style={styles.icon3DInner}>
                          {ic.is3D ? (
                            <Category3DIcon category={ic.key} size={36} />
                          ) : (
                            <View
                              style={[
                                styles.vectorIconCircle,
                                {
                                  backgroundColor: isSelected
                                    ? '#0D9488'
                                    : isDark
                                    ? '#25252D'
                                    : '#E2E8F0',
                                },
                              ]}
                            >
                              <Ionicons
                                name={ic.key as any}
                                size={20}
                                color={isSelected ? '#FFFFFF' : textCol}
                              />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.icon3DLabel,
                            {
                              color: isSelected ? '#0D9488' : textCol,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {ic.label}
                        </Text>

                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Feather name="check" size={9} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.btnRow, { borderTopColor: borderCol }]}>
            {isEdit && (
              <TouchableOpacity
                onPress={handleDelete}
                style={[
                  styles.deleteBtn,
                  {
                    borderColor: '#EF4444',
                    backgroundColor: isDark
                      ? 'rgba(239, 68, 68, 0.1)'
                      : '#FEE2E2',
                  },
                ]}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: '#0D9488',
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>
                  {isEdit ? 'Save Changes' : 'Create Category'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    maxHeight: 480,
  },
  scrollBodyContent: {
    paddingBottom: 14,
    gap: 12,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  previewIconWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  previewSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  previewTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewTagText: {
    color: '#0D9488',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  formSection: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  iconSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  selectedIconName: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: '45%',
  },
  iconSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  iconSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterTabPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 11,
  },
  icon3DGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  icon3DCard: {
    width: '31.3%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  icon3DInner: {
    marginBottom: 4,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vectorIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon3DLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchBox: {
    width: '100%',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptySearchText: {
    fontSize: 12,
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
