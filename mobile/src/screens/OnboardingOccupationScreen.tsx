import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  Occupation,
} from '../data/occupations';
import { GAME_CONFIGS, GameType } from '../data/gameCatalog';
import { OCCUPATION_GAME_POOLS, GENERAL_POOL } from '../data/occupationGamePools';
import { selectGames } from '../services/api';
import { startSession } from '../services/session';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { OnboardingData } from '../types/onboarding';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingOccupation'>;

const CATEGORIES_ORDER: OccupationCategory[] = [
  'technology', 'healthcare', 'business', 'education', 'legal', 'engineering', 'science', 'creative',
];

const ALL_GAME_TYPES: GameType[] = [
  'rule_discovery', 'planning', 'memory', 'logic',
  'reaction', 'stroop', 'matrix', 'spatial', 'estimation', 'search',
];

function pickRandomGames() {
  const shuffledTypes = [...ALL_GAME_TYPES].sort(() => Math.random() - 0.5).slice(0, 5);
  return shuffledTypes.map(type => {
    const configs = Object.values(GAME_CONFIGS).filter(g => g.type === type);
    const config = configs[Math.floor(Math.random() * configs.length)];
    return {
      configId: config.id,
      gameType: config.type,
      title: config.title,
      emoji: config.emoji,
      description: config.description,
    };
  });
}

function onboardingKey(userId: number) {
  return `bi_onboarding_${userId}`;
}

type SpecialSelection = 'student' | 'seeking_guidance';

export default function OnboardingOccupationScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const {
    onboarding,
    name,
    age,
    country,
    setEmploymentStatus,
    setFlowType,
  } = useOnboarding();

  const [selectedProfession, setSelectedProfession] = useState<Occupation | null>(null);
  const [selectedSpecial, setSelectedSpecial] = useState<SpecialSelection | null>(null);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [exploring, setExploring] = useState(false);
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

  const hasSelection = selectedProfession !== null || selectedSpecial !== null;

  function selectSpecial(type: SpecialSelection) {
    setSelectedSpecial(type);
    setSelectedProfession(null);
  }

  function selectProfession(occ: Occupation) {
    setSelectedProfession(occ);
    setSelectedSpecial(null);
  }

  async function saveOnboarding(data: OnboardingData) {
    if (auth.userId != null) {
      try {
        await AsyncStorage.setItem(onboardingKey(auth.userId), JSON.stringify(data));
      } catch {
        // Non-fatal
      }
    }
  }

  async function handleStart() {
    if (!hasSelection || selecting) return;
    setError('');
    setSelecting(true);

    const userId = auth.userId ?? undefined;
    const gender = onboarding.gender;
    const effectiveName = name || auth.displayName || 'User';

    try {
      if (selectedProfession) {
        // Employed path
        setEmploymentStatus('employed');
        setFlowType('employed');

        const data: OnboardingData = {
          ageRange: onboarding.ageRange ?? '18-24',
          gender: gender ?? 'male',
          employmentStatus: 'employed',
          flowType: 'employed',
        };
        await saveOnboarding(data);

        const profile: UserProfile = {
          userName: effectiveName,
          age: age || onboarding.ageRange || 'Not specified',
          country: country || 'Not specified',
          lifeStage: 'Mid Career',
          occupations: [selectedProfession.id],
          occupationTitles: [selectedProfession.title],
          occupationEmojis: [selectedProfession.emoji],
          interests: 'Not specified',
          ageRange: onboarding.ageRange,
          gender: gender,
          employmentStatus: 'employed',
          flowType: 'employed',
        };

        const pool = OCCUPATION_GAME_POOLS[selectedProfession.id] ?? GENERAL_POOL;
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
      } else if (selectedSpecial) {
        // Career guidance path
        const empStatus = selectedSpecial;
        setEmploymentStatus(empStatus);
        setFlowType('career_guidance');

        const data: OnboardingData = {
          ageRange: onboarding.ageRange ?? '18-24',
          gender: gender ?? 'male',
          employmentStatus: empStatus,
          flowType: 'career_guidance',
        };
        await saveOnboarding(data);

        navigation.navigate('UserProfile', { onboardingData: data });
      }
    } catch {
      setError('Could not connect to the server. Please check your connection and try again.');
    } finally {
      setSelecting(false);
    }
  }

  async function handleExplore() {
    if (exploring) return;
    setExploring(true);

    const sessionId = startSession();
    const gameQueue = pickRandomGames();

    const profile: UserProfile = {
      userName: name || auth.displayName || 'Explorer',
      age: age || onboarding.ageRange || 'Not specified',
      country: country || 'Not specified',
      lifeStage: 'Exploring',
      occupations: ['general'],
      occupationTitles: ['General Assessment'],
      occupationEmojis: ['🧭'],
      interests: 'Not specified',
      ageRange: onboarding.ageRange,
      gender: onboarding.gender,
      flowType: 'career_guidance',
    };

    navigation.replace('Game', {
      sessionId,
      userProfile: profile,
      gameQueue,
      currentIndex: 0,
      completedScores: [],
      userId: auth.userId ?? undefined,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 3 of 3</Text>
        <Text style={styles.title}>Your Occupation</Text>
        <Text style={styles.subtitle}>Select your profession or current situation.</Text>

        {/* Special options */}
        <TouchableOpacity
          style={[styles.specialCard, selectedSpecial === 'student' && styles.specialCardSelected]}
          onPress={() => selectSpecial('student')}
          activeOpacity={0.8}
        >
          <Text style={styles.specialEmoji}>🎓</Text>
          <View style={styles.specialText}>
            <Text style={[styles.specialTitle, selectedSpecial === 'student' && styles.specialTitleSelected]}>
              Student
            </Text>
            <Text style={styles.specialDesc}>Currently in education</Text>
          </View>
          <View style={[styles.radio, selectedSpecial === 'student' && styles.radioSelected]}>
            {selectedSpecial === 'student' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.specialCard, selectedSpecial === 'seeking_guidance' && styles.specialCardSelected]}
          onPress={() => selectSpecial('seeking_guidance')}
          activeOpacity={0.8}
        >
          <Text style={styles.specialEmoji}>🔍</Text>
          <View style={styles.specialText}>
            <Text style={[styles.specialTitle, selectedSpecial === 'seeking_guidance' && styles.specialTitleSelected]}>
              Exploring career options
            </Text>
            <Text style={styles.specialDesc}>Looking for career direction</Text>
          </View>
          <View style={[styles.radio, selectedSpecial === 'seeking_guidance' && styles.radioSelected]}>
            {selectedSpecial === 'seeking_guidance' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        {/* Search bar */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search professions…"
          placeholderTextColor="#5555aa"
          value={search}
          onChangeText={setSearch}
        />
      </View>

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
            style={[styles.listItem, selectedProfession?.id === item.id && styles.listItemSelected]}
            onPress={() => selectProfession(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.listItemEmoji}>{item.emoji}</Text>
            <View style={styles.listItemTextBlock}>
              <Text style={[styles.listItemTitle, selectedProfession?.id === item.id && styles.listItemTitleSelected]}>
                {item.title}
              </Text>
              <Text style={styles.listItemDesc}>{item.description}</Text>
            </View>
            {selectedProfession?.id === item.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 160 }}
      />

      {/* Sticky footer */}
      <View style={styles.footer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.startBtn, (!hasSelection || selecting) && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!hasSelection || selecting}
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

        <TouchableOpacity onPress={handleExplore} disabled={exploring} activeOpacity={0.7} style={styles.exploreRow}>
          {exploring
            ? <ActivityIndicator size="small" color="#4a4a7a" />
            : <Text style={styles.exploreText}>🎲  Just explore with random games</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  step: { color: '#4a4a7a', fontSize: 12, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#e0e0ff', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  specialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1f4a',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3a3a7e',
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  specialCardSelected: { backgroundColor: '#1e2250', borderColor: '#5c6bc0' },
  specialEmoji: { fontSize: 22, width: 30 },
  specialText: { flex: 1 },
  specialTitle: { color: '#9999cc', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  specialTitleSelected: { color: '#e0e0ff' },
  specialDesc: { color: '#5555aa', fontSize: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3a3a6e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#5c6bc0' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5c6bc0' },
  searchInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    color: '#e0e0ff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
    marginBottom: 4,
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
  listItemTextBlock: { flex: 1 },
  listItemTitle: { color: '#c0c0ee', fontSize: 15, fontWeight: '600' },
  listItemTitleSelected: { color: '#e0e0ff' },
  listItemDesc: { color: '#5555aa', fontSize: 12, marginTop: 2 },
  checkmark: { color: '#5c6bc0', fontSize: 18, fontWeight: 'bold' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#2a2a5e',
  },
  errorText: { color: '#ef5350', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  startBtn: { backgroundColor: '#5c6bc0', paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginBottom: 10 },
  startBtnDisabled: { backgroundColor: '#2a2a4e' },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exploreRow: { paddingVertical: 6, alignItems: 'center' },
  exploreText: { color: '#4a4a7a', fontSize: 13 },
});
