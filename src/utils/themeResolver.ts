import type { ThemeMode, ThemeColors, PartialThemeColors } from '../types';
import { defaultLightColors, defaultDarkColors } from './themeDefaults';

export function resolveThemeColors(
  theme: ThemeMode,
  lightCustom: PartialThemeColors,
  darkCustom: PartialThemeColors,
  customColors: PartialThemeColors
): ThemeColors {
  if (theme === 'light') {
    return { ...defaultLightColors, ...lightCustom };
  }
  if (theme === 'dark') {
    return { ...defaultDarkColors, ...darkCustom };
  }
  return { ...defaultLightColors, ...customColors };
}
