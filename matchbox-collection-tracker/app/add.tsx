import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterSheet } from '../src/components/FilterSheet';
import { ModelThumb } from '../src/components/ModelThumb';
import { SegmentedControl } from '../src/components/SegmentedControl';
import { getModelById } from '../src/data/catalog';
import { CATEGORIES, CONDITIONS, type Category, type CollectionStatus, type Condition } from '../src/data/types';
import { useCollection } from '../src/context/CollectionContext';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

export default function AddEditScreen() {
  const params = useLocalSearchParams<{ id?: string; catalogId?: string; status?: string }>();
  const { getItem, addItem, updateItem } = useCollection();

  const editingItem = params.id ? getItem(params.id) : undefined;
  const prefillModel = params.catalogId ? getModelById(params.catalogId) : undefined;

  const [status, setStatus] = useState<CollectionStatus>(
    (editingItem?.status ?? (params.status as CollectionStatus)) || 'owned'
  );
  const [name, setName] = useState(editingItem?.name ?? prefillModel?.name ?? '');
  const [number, setNumber] = useState(editingItem?.number ?? prefillModel?.number ?? '');
  const [series, setSeries] = useState(editingItem?.series ?? prefillModel?.series ?? '');
  const [year, setYear] = useState(String(editingItem?.year ?? prefillModel?.year ?? ''));
  const [category, setCategory] = useState<Category | undefined>(editingItem?.category ?? prefillModel?.category);
  const [color, setColor] = useState(editingItem?.color ?? prefillModel?.colors[0] ?? '');
  const [condition, setCondition] = useState<Condition>(editingItem?.condition ?? 'Good');
  const [hasBox, setHasBox] = useState(editingItem?.hasBox ?? false);
  const [quantity, setQuantity] = useState(editingItem?.quantity ?? 1);
  const [purchasePrice, setPurchasePrice] = useState(
    editingItem?.purchasePrice != null ? String(editingItem.purchasePrice) : ''
  );
  const [purchaseDate, setPurchaseDate] = useState(editingItem?.purchaseDate ?? '');
  const [notes, setNotes] = useState(editingItem?.notes ?? '');
  const [photoUri, setPhotoUri] = useState<string | undefined>(editingItem?.photoUri);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  const title = editingItem ? 'Edit Entry' : 'Add to Collection';
  const catalogId = editingItem?.catalogId ?? prefillModel?.id;

  const previewCategory = useMemo(() => category, [category]);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this entry a name before saving.');
      return;
    }
    const parsedYear = year.trim() ? parseInt(year, 10) : undefined;
    const parsedPrice = purchasePrice.trim() ? parseFloat(purchasePrice) : undefined;

    const payload = {
      catalogId,
      status,
      name: name.trim(),
      number: number.trim() || undefined,
      series: series.trim() || 'Custom',
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      category,
      color: color.trim() || 'Unknown',
      condition,
      hasBox,
      quantity: Math.max(1, quantity),
      purchasePrice: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
      purchaseDate: purchaseDate.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUri,
    };

    if (editingItem) {
      updateItem(editingItem.id, payload);
    } else {
      addItem(payload);
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.photoRow}>
            <Pressable onPress={pickPhoto}>
              <ModelThumb category={previewCategory} photoUri={photoUri} size={88} />
            </Pressable>
            <Pressable style={styles.photoBtn} onPress={pickPhoto}>
              <Text style={styles.photoBtnText}>{photoUri ? 'Change Photo' : 'Add Photo'}</Text>
            </Pressable>
          </View>

          <Label>Status</Label>
          <SegmentedControl
            options={['Owned', 'Wish List']}
            value={status === 'owned' ? 'Owned' : 'Wish List'}
            onChange={(v) => setStatus(v === 'Owned' ? 'owned' : 'wishlist')}
          />

          <Label>Name</Label>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. 1970 Plymouth Superbird" placeholderTextColor={colors.textFaint} />

          <View style={styles.row2}>
            <View style={styles.col}>
              <Label>Model #</Label>
              <TextInput style={styles.input} value={number} onChangeText={setNumber} placeholder="MB12" placeholderTextColor={colors.textFaint} />
            </View>
            <View style={styles.col}>
              <Label>Year</Label>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                placeholder="1970"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Label>Series</Label>
          <TextInput style={styles.input} value={series} onChangeText={setSeries} placeholder="Superfast" placeholderTextColor={colors.textFaint} />

          <Label>Category</Label>
          <Pressable style={styles.selectInput} onPress={() => setCategorySheetOpen(true)}>
            <Text style={category ? styles.selectValue : styles.selectPlaceholder}>
              {category ?? 'Choose a category'}
            </Text>
            <Text style={styles.selectCaret}>⌄</Text>
          </Pressable>

          <Label>Color</Label>
          <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Blue" placeholderTextColor={colors.textFaint} />

          {status === 'owned' && (
            <>
              <Label>Condition</Label>
              <View style={styles.chipRow}>
                {CONDITIONS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.conditionChip, condition === c && styles.conditionChipActive]}
                    onPress={() => setCondition(c)}
                  >
                    <Text style={[styles.conditionChipText, condition === c && styles.conditionChipTextActive]}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Label>Original Box</Label>
              <SegmentedControl
                options={['No', 'Yes']}
                value={hasBox ? 'Yes' : 'No'}
                onChange={(v) => setHasBox(v === 'Yes')}
              />
            </>
          )}

          <Label>Quantity</Label>
          <View style={styles.stepper}>
            <Pressable style={styles.stepperBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{quantity}</Text>
            <Pressable style={styles.stepperBtn} onPress={() => setQuantity((q) => q + 1)}>
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.row2}>
            <View style={styles.col}>
              <Label>Purchase Price</Label>
              <TextInput
                style={styles.input}
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                placeholder="12.99"
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.col}>
              <Label>Purchase Date</Label>
              <TextInput
                style={styles.input}
                value={purchaseDate}
                onChangeText={setPurchaseDate}
                placeholder="2024-05-01"
                placeholderTextColor={colors.textFaint}
              />
            </View>
          </View>

          <Label>Notes</Label>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Where you found it, variant details, condition notes..."
            placeholderTextColor={colors.textFaint}
            multiline
          />

          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>{editingItem ? 'Save Changes' : 'Save to Collection'}</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <FilterSheet
        visible={categorySheetOpen}
        title="Category"
        options={CATEGORIES}
        selected={category ?? null}
        onSelect={(v) => setCategory((v as Category) ?? undefined)}
        onClose={() => setCategorySheetOpen(false)}
      />
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 14,
  },
  photoBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  photoBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.accent,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectValue: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  selectPlaceholder: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textFaint,
  },
  selectCaret: {
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  conditionChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  conditionChipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  conditionChipTextActive: {
    color: colors.accent,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  stepperValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onAccent,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
});
