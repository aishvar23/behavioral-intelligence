import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { GAME_CONFIGS, GameType } from '../data/gameCatalog';
import { startSession } from '../services/session';

type Props = NativeStackScreenProps<RootStackParamList, 'OccupationIntent'>;

const ALL_TYPES: GameType[] = ['exploration', 'pattern', 'puzzle', 'memory', 'logic', 'reaction'];

function pickRandomGames() {
  // Shuffle types, take 3, then pick one random config from each
  const shuffledTypes = [...ALL_TYPES].sort(() => Math.random() - 0.5).slice(0, 3);
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

export default function OccupationIntentScreen({ navigation }: Props) {
  function handleNoOccupation() {
    const sessionId = startSession();
    const gameQueue = pickRandomGames();
    navigation.replace('Game', {
      sessionId,
      userProfile: {
        age: 'Not specified',
        occupation: 'general',
        occupationTitle: 'General Assessment',
        occupationEmoji: '🧭',
        interests: 'Not specified',
      },
      gameQueue,
      currentIndex: 0,
      completedScores: [],
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.title}>Before we begin…</Text>
      <Text style={styles.subtitle}>
        Do you have a target occupation in mind?
      </Text>

      <TouchableOpacity style={styles.cardYes} onPress={() => navigation.navigate('UserProfile')} activeOpacity={0.85}>
        <Text style={styles.cardEmoji}>✅</Text>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Yes, I have one in mind</Text>
          <Text style={styles.cardDesc}>Games and report will be tailored to your chosen occupation</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cardNo} onPress={handleNoOccupation} activeOpacity={0.85}>
        <Text style={styles.cardEmoji}>🎲</Text>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>No, just explore</Text>
          <Text style={styles.cardDesc}>We'll pick 3 games at random and give you general insights</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  emoji: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#e0e0ff', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#7777aa', textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  cardYes: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#1a2a4a', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1.5, borderColor: '#5c6bc0' },
  cardNo: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#16213e', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a5e' },
  cardEmoji: { fontSize: 28 },
  cardText: { flex: 1 },
  cardTitle: { color: '#e0e0ff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: '#7777aa', fontSize: 13, lineHeight: 19 },
});
