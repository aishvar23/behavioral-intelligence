import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { startSession } from '../services/session';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  function handleStart() {
    const sessionId = startSession();
    navigation.navigate('Game', { gameId: 'exploration', sessionId });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Behavioral Intelligence</Text>
      <Text style={styles.subtitle}>
        Play 3 short games to discover your cognitive profile.
      </Text>
      <View style={styles.games}>
        <GameBadge emoji="🏝️" label="Exploration Island" />
        <GameBadge emoji="🔍" label="Hidden Pattern Game" />
        <GameBadge emoji="🧩" label="Impossible Puzzle" />
      </View>
      <TouchableOpacity style={styles.button} onPress={handleStart}>
        <Text style={styles.buttonText}>Start Session</Text>
      </TouchableOpacity>
    </View>
  );
}

function GameBadge({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeEmoji}>{emoji}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0e0ff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#9999cc',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  games: {
    width: '100%',
    marginBottom: 40,
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  badgeEmoji: { fontSize: 24 },
  badgeLabel: { fontSize: 16, color: '#c0c0ee', fontWeight: '500' },
  button: {
    backgroundColor: '#5c6bc0',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
