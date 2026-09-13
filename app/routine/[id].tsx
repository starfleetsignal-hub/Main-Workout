import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PoseIcon } from '../../src/components/PoseIcon';
import { useRoutines } from '../../src/context/RoutineContext';
import { RoutineItem } from '../../src/data/types';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

function estimateMinutes(strength: number, stretch: number) {
  return Math.round(strength * 4 + stretch * 1.5);
}

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getRoutine, renameRoutine, deleteRoutine, removeItem, moveItem } = useRoutines();
  const routine = getRoutine(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameDraft, setNameDraft] = useState(routine?.name ?? '');

  if (!routine) {
    return (
      <View style={styles.screen}>
        <Text style={styles.notFound}>This routine no longer exists.</Text>
      </View>
    );
  }

  const routineId = routine.id;
  const strengthItems = routine.items.filter((i) => i.kind === 'strength');
  const stretchItems = routine.items.filter((i) => i.kind === 'stretch');
  const mins = estimateMinutes(strengthItems.length, stretchItems.length);

  function renderItem(item: RoutineItem, index: number, list: RoutineItem[]) {
    const color = item.kind === 'strength' ? colors.strength : colors.stretch;
    const badgeBg = item.kind === 'strength' ? colors.strengthSoft : colors.stretchSoft;
    return (
      <View key={item.id} style={styles.itemRow}>
        <View style={[styles.poseBadge, { backgroundColor: badgeBg }]}>
          <PoseIcon pose={item.pose} color={color} size={26} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>
            {item.muscleName} · {item.level ?? item.type} · {item.detail}
          </Text>
        </View>
        <View style={styles.itemActions}>
          <Pressable
            hitSlop={6}
            disabled={index === 0}
            onPress={() => moveItem(routineId, item.id, -1)}
            style={styles.moveBtn}
          >
            <Text style={[styles.moveBtnText, index === 0 && styles.moveBtnDisabled]}>↑</Text>
          </Pressable>
          <Pressable
            hitSlop={6}
            disabled={index === list.length - 1}
            onPress={() => moveItem(routineId, item.id, 1)}
            style={styles.moveBtn}
          >
            <Text style={[styles.moveBtnText, index === list.length - 1 && styles.moveBtnDisabled]}>↓</Text>
          </Pressable>
          <Pressable hitSlop={6} onPress={() => removeItem(routineId, item.id)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: routine.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          onBlur={() => renameRoutine(routine.id, nameDraft)}
          style={styles.nameInput}
          placeholder="Routine name"
          placeholderTextColor={colors.textFaint}
        />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{routine.items.length}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.strength }]}>{strengthItems.length}</Text>
            <Text style={styles.statLabel}>Strength</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.stretch }]}>{stretchItems.length}</Text>
            <Text style={styles.statLabel}>Stretch</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>~{mins}</Text>
            <Text style={styles.statLabel}>Est. min</Text>
          </View>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/routine/[id]/add', params: { id: routine.id } })}
        >
          <Text style={styles.addBtnText}>+ Add exercises</Text>
        </Pressable>

        {routine.items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>This routine is empty</Text>
            <Text style={styles.emptyText}>Tap "Add exercises" to pick strength moves and stretches from any muscle.</Text>
          </View>
        ) : (
          <>
            {strengthItems.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Strength</Text>
                {strengthItems.map((item, i) => renderItem(item, i, strengthItems))}
              </>
            )}
            {stretchItems.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Stretch</Text>
                {stretchItems.map((item, i) => renderItem(item, i, stretchItems))}
              </>
            )}
          </>
        )}

        <View style={styles.dangerZone}>
          {confirmDelete ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmText}>Delete "{routine.name}"?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => {
                    deleteRoutine(routine.id);
                    router.back();
                  }}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)}>
              <Text style={styles.deleteLink}>Delete this routine</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
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
  notFound: {
    color: colors.text,
    textAlign: 'center',
    marginTop: 60,
  },
  nameInput: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.extrabold,
    paddingVertical: 4,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.extrabold,
  },
  statLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: {
    color: colors.onAccent,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  poseBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    color: colors.text,
    fontSize: 14.5,
    fontFamily: fonts.bold,
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  moveBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  moveBtnText: {
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  moveBtnDisabled: {
    color: colors.textFaint,
    opacity: 0.3,
  },
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 4,
  },
  removeBtnText: {
    color: colors.danger,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  dangerZone: {
    marginTop: 26,
    alignItems: 'center',
  },
  deleteLink: {
    color: colors.danger,
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  confirmRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger + '55',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  confirmText: {
    color: colors.text,
    fontSize: 14,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.cardBorder,
  },
  cancelBtnText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  deleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.danger,
  },
  deleteBtnText: {
    color: colors.onAccent,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
