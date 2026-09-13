import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export function FilterSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <ScrollView style={{ maxHeight: 360 }}>
          <Pressable
            style={[styles.option, selected === null && styles.optionActive]}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          >
            <Text style={[styles.optionText, selected === null && styles.optionTextActive]}>All</Text>
          </Pressable>
          {options.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.option, selected === opt && styles.optionActive]}
              onPress={() => {
                onSelect(opt);
                onClose();
              }}
            >
              <Text style={[styles.optionText, selected === opt && styles.optionTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
  },
  optionText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textMuted,
  },
  optionTextActive: {
    color: colors.accent,
    fontFamily: fonts.bold,
  },
});
