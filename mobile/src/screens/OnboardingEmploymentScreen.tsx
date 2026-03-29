import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, UserProfile } from '../navigation/AppNavigator';
import { useOnboarding } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import { EmploymentStatus, OnboardingData } from '../types/onboarding';
import { GAME_CONFIGS, GameType } from '../data/gameCatalog';
import { startSession } from '../services/session';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingEmployment'>;

const ALL_TYPES: GameType[] = [
  'rule_discovery', 'planning', 'memory', 'logic',
  'reaction', 'stroop', 'matrix', 'spatial', 'estimation', 'search',
];

function pickRandomGames() {
  const shuffledTypes = [...ALL_TYPES].sort(() => Math.random() - 0.5).slice(0, 5);
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

const STATUS_OPTIONS: { value: EmploymentStatus; label: string; desc: string; emoji: string }[] = [
  { value: 'employed',        label: 'Employed',              desc: 'Currently working in a profession',    emoji: '💼' },
  { value: 'seeking_guidance',label: 'Seeking guidance',      desc: 'Looking for career direction',         emoji: '🧭' },
  { value: 'student',         label: 'Student',               desc: 'Currently in education',               emoji: '🎓' },
  { value: 'retired',         label: 'Retired',               desc: 'Previously worked in a profession',    emoji: '🌅' },
];

function onboardingKey(userId: number) {
  return `bi_onboarding_${userId}`;
}

export default function OnboardingEmploymentScreen({ navigation }: Props) {
  const { onboarding, setEmploymentStatus } = useOnboarding();
  const { auth } = useAuth();
  const [selected, setSelected] = useState<EmploymentStatus | null>(null);
  const [exploring, setExploring] = useState(false);

  async function saveOnboarding(data: OnboardingData) {
    if (auth.userId != null) {
      try {
        await AsyncStorage.setItem(onboardingKey(auth.userId), JSON.stringify(data));
      } catch {
        // Non-fatal
      }
    }
  }

  async function handleNext() {
    if (!selected || !onboarding.ageRange || !onboarding.gender) return;

    setEmploymentStatus(selected);

    const flowType =
      selected === 'employed' || selected === 'retired' ? 'employed' : 'career_guidance';

    const data: OnboardingData = {
      ageRange: onboarding.ageRange,
      gender: onboarding.gender,
      employmentStatus: selected,
      flowType,
    };

    await saveOnboarding(data);

    if (flowType === 'employed') {
      navigation.navigate('ProfessionSelection', { onboardingData: data });
    } else {
      navigation.navigate('UserProfile', { onboardingData: data });
    }
  }

  async function handleExplore() {
    if (exploring) return;
    setExploring(true);

    const ageRange = onboarding.ageRange ?? 'Not specified';
    const gender = onboarding.gender ?? 'Not specified';

    const sessionId = startSession();
    const gameQueue = pickRandomGames();

    const userProfile: UserProfile = {
      userName: auth.displayName ?? 'Explorer',
      age: ageRange,
      country: 'Not specified',
      lifeStage: 'Exploring',
      occupations: ['general'],
      occupationTitles: ['General Assessment'],
      occupationEmojis: ['🧭'],
      interests: 'Not specified',
      ageRange,
      gender,
      flowType: 'career_guidance',
    };

    navigation.replace('Game', {
      sessionId,
      userProfile,
      gameQueue,
      currentIndex: 0,
      completedScores: [],
      userId: auth.userId ?? undefined,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.step}>Step 3 of 3</Text>
      <Text style={styles.title}>What's your current situation?</Text>
      <Text style={styles.subtitle}>This determines the type of assessment and report you'll receive.</Text>

      <View style={styles.options}>
        {STATUS_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, selected === opt.value && styles.optionSelected]}
            onPress={() => setSelected(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionEmoji}>{opt.emoji}</Text>
            <View style={styles.optionTextBlock}>
              <Text style={[styles.optionLabel, selected === opt.value && styles.optionLabelSelected]}>
                {opt.label}
              </Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </View>
            <View style={[styles.radio, selected === opt.value && styles.radioSelected]}>
              {selected === opt.value && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, !selected && styles.btnDisabled]}
        onPress={handleNext}
        disabled={!selected}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>Start Assessment →</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleExplore} disabled={exploring} activeOpacity={0.7} style={styles.exploreRow}>
        {exploring
          ? <ActivityIndicator size="small" color="#4a4a7a" />
          : <Text style={styles.exploreText}>🎲  Just explore with random games</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  step: { color: '#4a4a7a', fontSize: 12, marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '700', color: '#e0e0ff', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  options: { width: '100%', gap: 12, marginBottom: 32 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a5e',
    padding: 16,
    gap: 12,
  },
  optionSelected: { backgroundColor: '#1e2050', borderColor: '#5c6bc0' },
  optionEmoji: { fontSize: 22, width: 30 },
  optionTextBlock: { flex: 1 },
  optionLabel: { color: '#9999cc', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  optionLabelSelected: { color: '#e0e0ff' },
  optionDesc: { color: '#5555aa', fontSize: 12 },
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
  btn: { backgroundColor: '#5c6bc0', width: '100%', paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginBottom: 20 },
  btnDisabled: { backgroundColor: '#2a2a4e' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  exploreRow: { paddingVertical: 8 },
  exploreText: { color: '#4a4a7a', fontSize: 13 },
});
