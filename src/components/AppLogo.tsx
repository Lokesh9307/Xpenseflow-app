import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'horizontal';
  showText?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

const ICON_LOGO = require('../../assets/app-logo.png');
const HORIZONTAL_DARK = require('../../assets/logo-horizontal-dark-4k.png');
const HORIZONTAL_LIGHT = require('../../assets/logo-horizontal-light-4k.png');

const SIZES = {
  xs: { iconSize: 24, height: 20, width: 90 },
  sm: { iconSize: 32, height: 26, width: 120 },
  md: { iconSize: 44, height: 36, width: 160 },
  lg: { iconSize: 60, height: 48, width: 210 },
  xl: { iconSize: 84, height: 64, width: 280 },
};

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  variant,
  showText = true,
  style,
  imageStyle,
}) => {
  const { isDark } = useTheme();
  const config = SIZES[size];

  // If user requested horizontal logo OR showText is true by default
  const isHorizontal = variant === 'horizontal' || (showText && variant !== 'icon');

  if (isHorizontal) {
    return (
      <View style={[styles.container, style]}>
        <Image
          source={isDark ? HORIZONTAL_DARK : HORIZONTAL_LIGHT}
          style={[
            {
              width: config.width,
              height: config.height,
              resizeMode: 'contain',
            },
            imageStyle,
          ]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={ICON_LOGO}
        style={[
          {
            width: config.iconSize,
            height: config.iconSize,
            borderRadius: config.iconSize * 0.22,
            resizeMode: 'contain',
          },
          imageStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppLogo;
