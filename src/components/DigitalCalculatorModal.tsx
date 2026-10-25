import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface DigitalCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  onUseResult?: (result: string) => void;
}

export const DigitalCalculatorModal: React.FC<DigitalCalculatorModalProps> = ({
  visible,
  onClose,
  onUseResult,
}) => {
  const { isDark } = useTheme();

  const t = {
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    keyBg: isDark ? '#1C1C20' : '#F1F5F9',
    keyText: isDark ? '#FFFFFF' : '#101012',
    fnKeyBg: isDark ? '#26262D' : '#E2E8F0',
    opKeyBg: isDark ? 'rgba(13, 148, 136, 0.16)' : '#CCFBF1',
    accentTeal: '#0D9488',
    overlayBg: 'rgba(0, 0, 0, 0.72)',
    handleBg: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
  };

  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearAll = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const toggleSign = () => {
    const value = parseFloat(display);
    setDisplay(String(-value));
  };

  const inputPercent = () => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operation) {
      const current = prevValue || 0;
      let newValue = current;

      switch (operation) {
        case '+':
          newValue = current + inputValue;
          break;
        case '−':
          newValue = current - inputValue;
          break;
        case '×':
          newValue = current * inputValue;
          break;
        case '÷':
          newValue = inputValue !== 0 ? current / inputValue : 0;
          break;
        default:
          break;
      }

      setPrevValue(newValue);
      setDisplay(String(Math.round(newValue * 100) / 100));
    }

    setWaitingForOperand(true);
    setOperation(nextOperator);
  };

  const handleEqual = () => {
    if (!operation || prevValue === null) return;
    const inputValue = parseFloat(display);
    let newValue = prevValue;

    switch (operation) {
      case '+':
        newValue = prevValue + inputValue;
        break;
      case '−':
        newValue = prevValue - inputValue;
        break;
      case '×':
        newValue = prevValue * inputValue;
        break;
      case '÷':
        newValue = inputValue !== 0 ? prevValue / inputValue : 0;
        break;
    }

    const rounded = Math.round(newValue * 100) / 100;
    setDisplay(String(rounded));
    setPrevValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  };

  const handleUseExpense = () => {
    if (onUseResult) {
      onUseResult(display);
      onClose();
    }
  };

  const buttons = [
    [
      { label: 'C', type: 'fn', onPress: clearAll },
      { label: '±', type: 'fn', onPress: toggleSign },
      { label: '%', type: 'fn', onPress: inputPercent },
      { label: '÷', type: 'op', onPress: () => performOperation('÷') },
    ],
    [
      { label: '7', type: 'num', onPress: () => inputDigit('7') },
      { label: '8', type: 'num', onPress: () => inputDigit('8') },
      { label: '9', type: 'num', onPress: () => inputDigit('9') },
      { label: '×', type: 'op', onPress: () => performOperation('×') },
    ],
    [
      { label: '4', type: 'num', onPress: () => inputDigit('4') },
      { label: '5', type: 'num', onPress: () => inputDigit('5') },
      { label: '6', type: 'num', onPress: () => inputDigit('6') },
      { label: '−', type: 'op', onPress: () => performOperation('−') },
    ],
    [
      { label: '1', type: 'num', onPress: () => inputDigit('1') },
      { label: '2', type: 'num', onPress: () => inputDigit('2') },
      { label: '3', type: 'num', onPress: () => inputDigit('3') },
      { label: '+', type: 'op', onPress: () => performOperation('+') },
    ],
    [
      { label: '0', type: 'num', isWide: true, onPress: () => inputDigit('0') },
      { label: '.', type: 'num', onPress: inputDot },
      { label: '=', type: 'equal', onPress: handleEqual },
    ],
  ];

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
            <View>
              <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Digital Calculator</Text>
              <Text style={[styles.sheetSub, { color: t.textMuted }]}>
                Quick expenditure calculations
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.keyBg }]}>
              <Feather name="x" size={18} color={t.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Calculator Screen Display */}
          <View style={[styles.displayCard, { backgroundColor: t.keyBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.operatorText, { color: t.accentTeal }]}>
              {operation ? operation : ''}
            </Text>
            <Text
              style={[styles.displayText, { color: t.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {display}
            </Text>
          </View>

          {/* Keypad */}
          <View style={styles.keypad}>
            {buttons.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.row}>
                {row.map((btn) => {
                  let btnBg = t.keyBg;
                  let textColor = t.keyText;

                  if (btn.type === 'op') {
                    btnBg = t.opKeyBg;
                    textColor = t.accentTeal;
                  } else if (btn.type === 'equal') {
                    btnBg = t.accentTeal;
                    textColor = '#ffffff';
                  } else if (btn.type === 'fn') {
                    btnBg = t.fnKeyBg;
                    textColor = t.textMuted;
                  }

                  return (
                    <TouchableOpacity
                      key={btn.label}
                      onPress={btn.onPress}
                      style={[
                        styles.button,
                        { backgroundColor: btnBg },
                        btn.isWide && styles.buttonWide,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.buttonText, { color: textColor }]}>
                        {btn.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Bottom Action: Use in Expense */}
          {onUseResult && (
            <TouchableOpacity
              style={[styles.useBtn, { backgroundColor: t.accentTeal }]}
              onPress={handleUseExpense}
              activeOpacity={0.85}
            >
              <Text style={styles.useBtnText}>Use ₹{display} in Expense</Text>
            </TouchableOpacity>
          )}
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
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 74,
  },
  operatorText: {
    position: 'absolute',
    left: 18,
    top: 14,
    fontSize: 22,
    fontWeight: '700',
  },
  displayText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  keypad: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWide: {
    flex: 2.1,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
  },
  useBtn: {
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
