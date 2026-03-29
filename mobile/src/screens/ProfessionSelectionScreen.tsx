import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, UserProfile } from '../navigation/AppNavigator';
import {
  OCCUPATION_CATEGORY_LABELS,
  OccupationCategory,
  getOccupationsByCategory,
  Occupation,
} from '../data/occupations';
import { GAME_CONFIGS } from '../data/gameCatalog';
import { OCCUPATION_GAME_POOLS, GENERAL_POOL } from '../data/occupationGamePools';
import { selectGames } from '../services/api';
import { startSession } from '../services/session';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfessionSelection'>;

const CATEGORIES_ORDER: OccupationCategory[] = [
  'technology', 'healthcare', 'business', 'education', 'legal', 'engineering', 'science', 'creative',
];

export default function ProfessionSelectionScreen({ navigation, route }: Props) {
  const { onboardingData } = route.params;
  const { auth } = useAuth();

  const [selected, setSelected] = useState<Occupation | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');

  const byCategory = useMemo(() => getOccupationsByCategory(), []);

  const sections = useMemo(() => {
    const q = search.toLowerCase().trim();
    return CATEGORIES_ORDER.map(cat => ({
      title: OCCUPATION_CATEGORY_LABELS[cat],
      data: (byCategory[cat] ?? []).filter(o =>
        !q || o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
      ),
    })).filter(s => s.data.length > 0);
  }, [search, byCategory]);

  const isRetired = onboardingData.employmentStatus === 'retired';
  const screenTitle = isRetired ? 'What was your last profession?' : 'What is your current profession?';
  const screenSubtitle = isRetired
    ? 'Your cognitive assessment will be based on the profession you retired from.'
    : 'We\'ll select games and calibrate your assessment for this role.';

  async function handleStart() {
    if (!selected || selecting) return;
    setError('');
    setSelecting(true);

    const userId = auth.userId ?? undefined;

    const profile: UserProfile = {
      userName: auth.displayName ?? '',
      age: onboardingData.ageRange,
      country: 'Not specified',
      lifeStage: isRetired ? 'Retired' : 'Mid Career',
      occupations: [selected.id],
      occupationTitles: [selected.title],
      occupationEmojis: [selected.emoji],
      interests: 'Not specified',
      ageRange: onboardingData.ageRange,
      gender: onboardingData.gender,
      employmentStatus: onboardingData.employmentStatus,
      flowType: 'employed',
    };

    try {
      const pool = OCCUPATION_GAME_POOLS[selected.id] ?? GENERAL_POOL;
      const { selectedIds } = await selectGames(profile, pool, userId, 'employed');

      const sessionId = startSession();
      const gameQueue = selectedIds.map(id => {
        const cfg = GAME_CONFIGS[id];
        return {
          configId: id,
          gameType: cfg?.type ?? 'pattern',
          title: cfg?.title ?? id,
          emoji: cfg?.emoji ?? '🎮',
          description: cfg?.description ?? '',
        };
      });

      navigation.replace('Game', {
        sessionId,
        userProfile: profile,
        gameQueue,
        currentIndex: 0,
        completedScores: [],
        userId,
      });
    } catch {
      setError('Could not connect to the server. Please check your connection and try again.');
    } finally {
      setSelecting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>{screenTitle}</Text>
        <Text style={styles.subtitle}>{screenSubtitle}</Text>

        <TouchableOpacity
          style={[styles.pickerBtn, selected && styles.pickerBtnSelected]}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.8}
        >
          {selected ? (
            <View style={styles.selectedRow}>
              <Text style={styles.selectedEmoji}>{selected.emoji}</Text>
              <Text style={styles.selectedTitle}>{selected.title}</Text>
            </View>
          ) : (
            <Text style={styles.pickerPlaceholder}>Select profession…</Text>
          )}
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.startBtn, (!selected || selecting) && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!selected || selecting}
          activeOpacity={0.85}
        >
          {selecting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.startBtnText}>Selecting your games…</Text>
            </View>
          ) : (
            <Text style={styles.startBtnText}>Start Assessment →</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>5 games tailored to your profession's cognitive demands</Text>
      </View>

      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Profession</Text>
            <TouchableOpacity
              onPress={() => { setShowPicker(false); setSearch(''); }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search professions…"
            placeholderTextColor="#5555aa"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />

          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, selected?.id === item.id && styles.listItemSelected]}
                onPress={() => { setSelected(item); setShowPicker(false); setSearch(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.listItemEmoji}>{item.emoji}</Text>
                <View style={styles.listItemText}>
                  <Text style={[styles.listItemTitle, selected?.id === item.id && styles.listItemTitleSelected]}>
                    {item.title}
                  </Text>
                  <Text style={styles.listItemDesc}>{item.description}</Text>
                </View>
                {selected?.id === item.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { flex: 1, padding: 28, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#e0e0ff', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  pickerBtn: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a5e',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  pickerBtnSelected: { borderColor: '#5c6bc0' },
  selectedRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedEmoji: { fontSize: 22 },
  selectedTitle: { color: '#e0e0ff', fontSize: 16, fontWeight: '600', flex: 1 },
  pickerPlaceholder: { color: '#5555aa', fontSize: 15, flex: 1 },
  chevron: { color: '#5c6bc0', fontSize: 22 },
  errorText: { color: '#ef5350', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  startBtn: { backgroundColor: '#5c6bc0', paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginBottom: 14 },
  startBtnDisabled: { backgroundColor: '#2a2a4e' },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { color: '#4a4a7a', fontSize: 12, textAlign: 'center' },
  // Modal
  modal: { flex: 1, backgroundColor: '#1a1a2e' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', flex: 1 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: '#9999cc', fontSize: 20 },
  searchInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    color: '#e0e0ff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeader: { backgroundColor: '#0f1228', paddingHorizontal: 20, paddingVertical: 8 },
  sectionHeaderText: { color: '#5c6bc0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3e',
    gap: 12,
  },
  listItemSelected: { backgroundColor: '#1e2050' },
  listItemEmoji: { fontSize: 22, width: 32 },
  listItemText: { flex: 1 },
  listItemTitle: { color: '#c0c0ee', fontSize: 15, fontWeight: '600' },
  listItemTitleSelected: { color: '#e0e0ff' },
  listItemDesc: { color: '#5555aa', fontSize: 12, marginTop: 2 },
  checkmark: { color: '#5c6bc0', fontSize: 18, fontWeight: 'bold' },
});
