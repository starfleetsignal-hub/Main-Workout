import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * react-native-web ships `Alert.alert` as a complete no-op (`static alert()
 * {}`) — every confirmation and warning dialog in this app would silently
 * do nothing on the web build. This mirrors Alert.alert's call signature so
 * every existing call site is a drop-in swap, and falls back to the
 * browser's own confirm()/alert() on web. A native confirm() is a fair
 * substitute here because every call in this app is either a one-line
 * notice or a plain two-way choice — nothing needs a styled modal.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const actionButton = buttons.find((b) => b !== cancelButton) ?? buttons[buttons.length - 1];
  if (window.confirm(text)) actionButton.onPress?.();
  else cancelButton?.onPress?.();
}
