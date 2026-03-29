import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, UserProfile } from '../navigation/AppNavigator';
import {
  OCCUPATION_CATEGORY_LABELS,
  OccupationCategory,
  getOccupationsByCategory,
} from '../data/occupations';
import { COUNTRIES } from '../data/countries';
import { GAME_CONFIGS } from '../data/gameCatalog';
import { OCCUPATION_GAME_POOLS, GENERAL_POOL } from '../data/occupationGamePools';
import { selectGames, registerUser } from '../services/api';
import { startSession } from '../services/session';
import { useAuth } from '../context/AuthContext';
import { guestStore } from '../services/guestStore';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

function lifeStageFromEmploymentStatus(status: string): string {
  if (status === 'student') return 'Student';
  if (status === 'seeking_guidance') return 'Exploring';
  return '';
}

type SavedProfile = {
  age: string;
  country: string;
  lifeStage: string;
  interests: string;
  occupations: string[];
  occupationTitles: string[];
  occupationEmojis: string[];
};

const CATEGORIES_ORDER: OccupationCategory[] = [
  'technology', 'healthcare', 'business', 'education', 'legal', 'engineering', 'science', 'creative',
];

const LIFE_STAGES = ['Student', 'Graduate', 'Early Career', 'Mid Career', 'Career Change', 'Exploring'];

function profileKey(userId: number) {
  return `bi_profile_${userId}`;
}

/** Merge game pools for multiple occupations, deduplicating entries. */
function mergeGamePools(occupationIds: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of occupationIds) {
    const pool = OCCUPATION_GAME_POOLS[id] ?? GENERAL_POOL;
    for (const game of pool) {
      if (!seen.has(game)) {
        seen.add(game);
        merged.push(game);
      }
    }
  }
  return merged.length > 0 ? merged : GENERAL_POOL;
}

export default function UserProfileScreen({ navigation, route }: Props) {
  const { onboardingData } = route.params;
  const { auth } = useAuth();
  const isAuthenticated = auth.userId != null && !auth.isGuest;

  // Pre-fill name/age/country from guestStore for guests coming through GuestSetup
  const guestBasic = guestStore.get();

  const [loaded, setLoaded] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);

  const [userName, setUserName] = useState(guestBasic?.name ?? '');
  const [age, setAge] = useState(guestBasic?.age ?? '');
  const [country, setCountry] = useState(guestBasic?.country ?? 'India');
  const [lifeStage, setLifeStage] = useState('');
  const [interests, setInterests] = useState('');

  // Multi-select occupations
  const [selectedOccupations, setSelectedOccupations] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<Record<string, string>>({});
  const [selectedEmojis, setSelectedEmojis] = useState<Record<string, string>>({});

  const [showOccupationPicker, setShowOccupationPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [occSearch, setOccSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');

  const byCategory = useMemo(() => getOccupationsByCategory(), []);

  const filteredOccSections = useMemo(() => {
    const q = occSearch.toLowerCase().trim();
    return CATEGORIES_ORDER.map(cat => ({
      title: OCCUPATION_CATEGORY_LABELS[cat],
      data: (byCategory[cat] ?? []).filter(o =>
        !q || o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
      ),
    })).filter(s => s.data.length > 0);
  }, [occSearch, byCategory]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase().trim();
    return q ? COUNTRIES.filter(c => c.toLowerCase().includes(q)) : COUNTRIES;
  }, [countrySearch]);

  // Load saved profile for authenticated users
  useEffect(() => {
    async function loadProfile() {
      if (isAuthenticated && auth.userId != null) {
        try {
          const raw = await AsyncStorage.getItem(profileKey(auth.userId));
          if (raw) {
            const saved = JSON.parse(raw);
            setAge(saved.age ?? '');
            setCountry(saved.country ?? 'India');
            setLifeStage(saved.lifeStage ?? '');
            setInterests(saved.interests ?? '');

            // Migrate old singular format → new array format
            const occs: string[] = Array.isArray(saved.occupations)
              ? saved.occupations
              : saved.occupation ? [saved.occupation] : [];
            const titles: Record<string, string> = {};
            const emojis: Record<string, string> = {};
            occs.forEach((id, i) => {
              titles[id] = (Array.isArray(saved.occupationTitles)
                ? saved.occupationTitles[i]
                : saved.occupationTitle) ?? id;
              emojis[id] = (Array.isArray(saved.occupationEmojis)
                ? saved.occupationEmojis[i]
                : saved.occupationEmoji) ?? '💼';
            });
            setSelectedOccupations(occs);
            setSelectedTitles(titles);
            setSelectedEmojis(emojis);
            setHasSavedProfile(occs.length > 0);
          }
        } catch {
          // Non-fatal
        }
      }
      setLoaded(true);
    }
    loadProfile();
  }, [isAuthenticated, auth.userId]);

  function toggleOccupation(id: string, title: string, emoji: string) {
    setSelectedOccupations(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
    setSelectedTitles(prev => ({ ...prev, [id]: title }));
    setSelectedEmojis(prev => ({ ...prev, [id]: emoji }));
  }

  async function saveProfile() {
    if (!isAuthenticated || auth.userId == null || selectedOccupations.length === 0) return;
    const saved: SavedProfile = {
      age, country, lifeStage, interests,
      occupations: selectedOccupations,
      occupationTitles: selectedOccupations.map(id => selectedTitles[id] ?? id),
      occupationEmojis: selectedOccupations.map(id => selectedEmojis[id] ?? '💼'),
    };
    try {
      await AsyncStorage.setItem(profileKey(auth.userId), JSON.stringify(saved));
    } catch {
      // Non-fatal
    }
  }

  async function handleStart() {
    if (selectedOccupations.length === 0 || selecting) return;

    const effectiveName = isAuthenticated ? (auth.displayName ?? '') : userName.trim();
    if (!isAuthenticated && !effectiveName) {
      setError('Please enter a username to track your progress across sessions.');
      return;
    }

    setError('');
    setSelecting(true);

    const profile: UserProfile = {
      userName: effectiveName,
      age: onboardingData.ageRange,
      country,
      lifeStage: lifeStage || lifeStageFromEmploymentStatus(onboardingData.employmentStatus) || 'Not specified',
      occupations: selectedOccupations,
      occupationTitles: selectedOccupations.map(id => selectedTitles[id] ?? id),
      occupationEmojis: selectedOccupations.map(id => selectedEmojis[id] ?? '💼'),
      interests: interests.trim() || 'Not specified',
      ageRange: onboardingData.ageRange,
      gender: onboardingData.gender,
      employmentStatus: onboardingData.employmentStatus,
      flowType: 'career_guidance',
    };

    try {
      let userId: number | undefined;
      if (auth.userId != null) {
        userId = auth.userId;
      } else {
        try {
          const userResult = await registerUser(profile.userName, profile.age, profile.country, profile.lifeStage);
          userId = userResult.userId;
        } catch {
          console.warn('User registration failed — proceeding without history');
        }
      }

      await saveProfile();

      const pool = mergeGamePools(selectedOccupations);
      const { selectedIds } = await selectGames(profile, pool, userId, 'career_guidance');

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

      guestStore.clear();
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

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#5c6bc0" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const pageTitle = hasSavedProfile ? 'Update your profile' : 'Tell us about yourself';
  const pageSubtitle = hasSavedProfile
    ? 'Your previous selections are loaded. Adjust anything before starting.'
    : "We'll select the right games for your occupation and generate a personalised behavioral report.";

  const occupationSummary = selectedOccupations.length === 0
    ? null
    : selectedOccupations.map(id => `${selectedEmojis[id] ?? ''} ${selectedTitles[id] ?? id}`).join('   ');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={[]}
          renderItem={() => null}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.content}>
              <Text style={styles.title}>{pageTitle}</Text>
              <Text style={styles.subtitle}>{pageSubtitle}</Text>

              {/* Identity row for authenticated users */}
              {isAuthenticated ? (
                <View style={styles.identityRow}>
                  <Text style={styles.identityLabel}>Signed in as</Text>
                  <Text style={styles.identityName}>{auth.displayName}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>
                    Username <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. alex_2025"
                    placeholderTextColor="#5555aa"
                    value={userName}
                    onChangeText={setUserName}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={50}
                  />
                  <Text style={styles.fieldNote}>Used to track your progress across sessions. Never shared externally.</Text>
                </>
              )}

              {/* Age */}
              <Text style={styles.label}>Your Age</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 26"
                placeholderTextColor="#5555aa"
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
                maxLength={3}
              />

              {/* Country — dropdown */}
              <Text style={styles.label}>Country</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.pickerBtnText}>{country}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>

              {/* Life Stage */}
              <Text style={styles.label}>Current Life Stage</Text>
              <View style={styles.pillsRow}>
                {LIFE_STAGES.map(stage => (
                  <TouchableOpacity
                    key={stage}
                    style={[styles.pill, lifeStage === stage && styles.pillSelected]}
                    onPress={() => setLifeStage(stage === lifeStage ? '' : stage)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, lifeStage === stage && styles.pillTextSelected]}>
                      {stage}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Occupation — multi-select */}
              <Text style={styles.label}>
                Target / Current Occupation <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.fieldNote2}>Select one or more occupations</Text>
              <TouchableOpacity
                style={[styles.pickerBtn, selectedOccupations.length > 0 && styles.pickerBtnSelected]}
                onPress={() => setShowOccupationPicker(true)}
                activeOpacity={0.8}
              >
                {occupationSummary ? (
                  <Text style={styles.pickerBtnText} numberOfLines={2}>{occupationSummary}</Text>
                ) : (
                  <Text style={styles.pickerPlaceholder}>Select occupation(s)…</Text>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              {selectedOccupations.length > 0 && (
                <Text style={styles.selectionCount}>{selectedOccupations.length} selected</Text>
              )}

              {/* Area of Interest */}
              <Text style={styles.label}>Area of Interest</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="e.g. Machine learning, public health, creative writing…"
                placeholderTextColor="#5555aa"
                value={interests}
                onChangeText={setInterests}
                multiline
                numberOfLines={3}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.startBtn, (selectedOccupations.length === 0 || selecting) && styles.startBtnDisabled]}
                onPress={handleStart}
                disabled={selectedOccupations.length === 0 || selecting}
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
              <Text style={styles.note}>
                5 games selected for{' '}
                <Text style={styles.noteBold}>
                  {selectedOccupations.length > 0
                    ? selectedOccupations.map(id => selectedTitles[id]).join(', ')
                    : 'your occupation'}
                </Text>
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" onRequestClose={() => setShowCountryPicker(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search countries…"
            placeholderTextColor="#5555aa"
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoFocus
          />
          <FlatList
            data={filteredCountries}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, country === item && styles.listItemSelected]}
                onPress={() => { setCountry(item); setShowCountryPicker(false); setCountrySearch(''); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.listItemText, country === item && styles.listItemTextSelected]}>{item}</Text>
                {country === item && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>

      {/* Occupation Picker Modal */}
      <Modal visible={showOccupationPicker} animationType="slide" onRequestClose={() => setShowOccupationPicker(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Occupation(s)</Text>
            <TouchableOpacity
              onPress={() => { setShowOccupationPicker(false); setOccSearch(''); }}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>Done{selectedOccupations.length > 0 ? ` (${selectedOccupations.length})` : ''}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search occupations…"
            placeholderTextColor="#5555aa"
            value={occSearch}
            onChangeText={setOccSearch}
            autoFocus
          />
          <SectionList
            sections={filteredOccSections}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const isSelected = selectedOccupations.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.occItem, isSelected && styles.occItemSelected]}
                  onPress={() => toggleOccupation(item.id, item.title, item.emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.occEmoji}>{item.emoji}</Text>
                  <View style={styles.occText}>
                    <Text style={[styles.occTitle, isSelected && styles.occTitleSelected]}>{item.title}</Text>
                    <Text style={styles.occDesc}>{item.description}</Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
    gap: 8,
  },
  identityLabel: { color: '#5555aa', fontSize: 13 },
  identityName: { color: '#a0a0ff', fontSize: 15, fontWeight: '700', flex: 1 },
  label: { color: '#c0c0ee', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  required: { color: '#ef5350' },
  fieldNote: { color: '#4a4a7a', fontSize: 11, marginTop: -14, marginBottom: 20 },
  fieldNote2: { color: '#4a4a7a', fontSize: 11, marginTop: -4, marginBottom: 10 },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    color: '#e0e0ff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  pillSelected: { backgroundColor: '#2a2a6e', borderColor: '#5c6bc0' },
  pillText: { color: '#6666aa', fontSize: 13, fontWeight: '500' },
  pillTextSelected: { color: '#c0c0ff', fontWeight: '700' },
  pickerBtn: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickerBtnSelected: { borderColor: '#5c6bc0' },
  pickerBtnText: { color: '#e0e0ff', fontSize: 15, flex: 1 },
  pickerPlaceholder: { color: '#5555aa', fontSize: 15, flex: 1 },
  chevron: { color: '#5c6bc0', fontSize: 22 },
  selectionCount: { color: '#5c6bc0', fontSize: 12, marginBottom: 16, marginLeft: 4 },
  errorText: { color: '#ef5350', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  startBtn: { backgroundColor: '#5c6bc0', paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginBottom: 16 },
  startBtnDisabled: { backgroundColor: '#2a2a4e' },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { color: '#4a4a7a', fontSize: 12, textAlign: 'center' },
  noteBold: { color: '#6a6aaa' },
  // Modals
  modal: { flex: 1, backgroundColor: '#1a1a2e' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', flex: 1 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: '#9999cc', fontSize: 20 },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#5c6bc0', borderRadius: 20 },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3e',
  },
  listItemSelected: { backgroundColor: '#1e2050' },
  listItemText: { color: '#c0c0ee', fontSize: 15, flex: 1 },
  listItemTextSelected: { color: '#e0e0ff', fontWeight: '600' },
  sectionHeader: { backgroundColor: '#0f1228', paddingHorizontal: 20, paddingVertical: 8 },
  sectionHeaderText: { color: '#5c6bc0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  occItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3e',
    gap: 12,
  },
  occItemSelected: { backgroundColor: '#1e2050' },
  occEmoji: { fontSize: 24, width: 36 },
  occText: { flex: 1 },
  occTitle: { color: '#c0c0ee', fontSize: 15, fontWeight: '600' },
  occTitleSelected: { color: '#e0e0ff' },
  occDesc: { color: '#5555aa', fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2a2a5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#5c6bc0', borderColor: '#5c6bc0' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  checkmark: { color: '#5c6bc0', fontSize: 18, fontWeight: 'bold' },
});
