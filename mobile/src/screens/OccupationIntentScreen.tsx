import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, UserProfile } from '../navigation/AppNavigator';
import { GAME_CONFIGS, GameType } from '../data/gameCatalog';
import { OCCUPATION_GAME_POOLS, GENERAL_POOL } from '../data/occupationGamePools';
import { startSession } from '../services/session';
import { selectGames } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { guestStore } from '../services/guestStore';

type Props = NativeStackScreenProps<RootStackParamList, 'OccupationIntent'>;

const ALL_TYPES: GameType[] = ['rule_discovery', 'planning', 'memory', 'logic', 'reaction', 'stroop', 'matrix', 'spatial', 'estimation', 'search'];

function pickRandomGames() {
  const shuffledTypes = [...ALL_TYPES].sort(() => Math.random() - 0.5).slice(0, 5);
  return shuffledTypes.map(type => {
    const configs = Object.values(GAME_CONFIGS).filter(g => g.type === type);
    const cfg = configs[Math.floor(Math.random() * configs.length)];
    return { configId: cfg.id, gameType: cfg.type, title: cfg.title, emoji: cfg.emoji, description: cfg.description };
  });
}

function mergeGamePools(occupationIds: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of occupationIds) {
    for (const game of (OCCUPATION_GAME_POOLS[id] ?? GENERAL_POOL)) {
      if (!seen.has(game)) { seen.add(game); merged.push(game); }
    }
  }
  return merged.length > 0 ? merged : GENERAL_POOL;
}

function profileKey(userId: number) { return `bi_profile_${userId}`; }

export default function OccupationIntentScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const isAuthenticated = auth.userId != null && !auth.isGuest;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleYesOccupation() {
    // Guests → go to full profile form to pick occupation
    if (!isAuthenticated) {
      navigation.navigate('UserProfile', undefined);
      return;
    }

    // Logged-in users → load saved profile and start game directly
    setLoading(true);
    setError('');
    try {
      const raw = await AsyncStorage.getItem(profileKey(auth.userId!));
      const saved = raw ? JSON.parse(raw) : null;

      if (!saved || !Array.isArray(saved.occupations) || saved.occupations.length === 0) {
        // No profile saved yet — go fill it in
        navigation.navigate('UserProfile', undefined);
        return;
      }

      const profile: UserProfile = {
        userName: auth.displayName ?? '',
        age: saved.age ?? 'Not specified',
        country: saved.country ?? 'Not specified',
        lifeStage: saved.lifeStage ?? 'Not specified',
        occupations: saved.occupations,
        occupationTitles: saved.occupationTitles ?? saved.occupations,
        occupationEmojis: saved.occupationEmojis ?? saved.occupations.map(() => '💼'),
        interests: saved.interests ?? 'Not specified',
      };

      const pool = mergeGamePools(profile.occupations);
      const { selectedIds } = await selectGames(profile, pool, auth.userId ?? undefined);

      const sessionId = startSession();
      const gameQueue = selectedIds.map(id => {
        const cfg = GAME_CONFIGS[id];
        return { configId: id, gameType: cfg?.type ?? 'pattern', title: cfg?.title ?? id, emoji: cfg?.emoji ?? '🎮', description: cfg?.description ?? '' };
      });

      navigation.replace('Game', {
        sessionId,
        userProfile: profile,
        gameQueue,
        currentIndex: 0,
        completedScores: [],
        userId: auth.userId ?? undefined,
      });
    } catch {
      setError('Could not start assessment. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleNoOccupation() {
    const guest = guestStore.get();
    const sessionId = startSession();
    const gameQueue = pickRandomGames();
    navigation.replace('Game', {
      sessionId,
      userProfile: {
        userName: isAuthenticated ? (auth.displayName ?? '') : (guest?.name ?? ''),
        age: guest?.age ?? 'Not specified',
        country: guest?.country ?? 'Not specified',
        lifeStage: 'Not specified',
        occupations: ['general'],
        occupationTitles: ['General Assessment'],
        occupationEmojis: ['🧭'],
        interests: 'Not specified',
      },
      gameQueue,
      currentIndex: 0,
      completedScores: [],
      userId: auth.userId ?? undefined,
    });
    guestStore.clear();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.title}>Before we begin…</Text>
      <Text style={styles.subtitle}>Do you have a target occupation in mind?</Text>

      <TouchableOpacity
        style={[styles.cardYes, loading && styles.cardDisabled]}
        onPress={handleYesOccupation}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#5c6bc0" size="small" />
        ) : (
          <Text style={styles.cardEmoji}>✅</Text>
        )}
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Yes, I have one in mind</Text>
          <Text style={styles.cardDesc}>
            {isAuthenticated
              ? 'Uses your saved profile to select personalised games'
              : 'Games and report will be tailored to your chosen occupation'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cardNo} onPress={handleNoOccupation} activeOpacity={0.85}>
        <Text style={styles.cardEmoji}>🎲</Text>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>No, just explore</Text>
          <Text style={styles.cardDesc}>We'll pick 5 games at random and give you general insights</Text>
        </View>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  emoji:        { fontSize: 52, marginBottom: 16 },
  title:        { fontSize: 24, fontWeight: '700', color: '#e0e0ff', marginBottom: 10, textAlign: 'center' },
  subtitle:     { fontSize: 16, color: '#7777aa', textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  cardYes:      { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#1a2a4a', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1.5, borderColor: '#5c6bc0' },
  cardNo:       { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#16213e', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a5e' },
  cardDisabled: { opacity: 0.6 },
  cardEmoji:    { fontSize: 28 },
  cardText:     { flex: 1 },
  cardTitle:    { color: '#e0e0ff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardDesc:     { color: '#7777aa', fontSize: 13, lineHeight: 19 },
  errorText:    { color: '#ef5350', fontSize: 13, textAlign: 'center', marginTop: 20 },
});
