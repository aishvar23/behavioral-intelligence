import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { auth, logout } = useAuth();
  const name = auth.displayName;

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>🧠</Text>
        {name ? (
          <Text style={styles.greeting}>Hi, {name} 👋</Text>
        ) : null}
        <Text style={styles.title}>Behavioral Intelligence</Text>
        <Text style={styles.tagline}>
          Play 5 personalised cognitive games.{'\n'}Discover your thinking style and career fit.
        </Text>
      </View>

      <View style={styles.features}>
        {[
          { icon: '🎯', text: 'Games tailored to your occupation' },
          { icon: '📊', text: 'Real-time behavioral trait analysis' },
          { icon: '✨', text: 'Personalised career recommendations' },
        ].map(f => (
          <View key={f.text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('OccupationIntent')} activeOpacity={0.85}>
        <Text style={styles.btnText}>Begin Assessment →</Text>
      </TouchableOpacity>

      <Text style={styles.note}>Takes about 10–15 minutes</Text>
      {!auth.isGuest && auth.userId ? (
        <TouchableOpacity onPress={logout} activeOpacity={0.7} style={styles.signOutRow}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  hero: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 14, textAlign: 'center' },
  tagline: { fontSize: 16, color: '#7777aa', textAlign: 'center', lineHeight: 24 },
  features: { width: '100%', gap: 14, marginBottom: 40 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#16213e', borderRadius: 12, padding: 14 },
  featureIcon: { fontSize: 22 },
  featureText: { color: '#c0c0ee', fontSize: 14, flex: 1 },
  btn: {
    backgroundColor: '#5c6bc0',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  note: { color: '#4a4a7a', fontSize: 12 },
  greeting: { fontSize: 18, color: '#a0a0dd', marginBottom: 8, fontWeight: '600' },
  signOutRow: { marginTop: 12 },
  signOutText: { color: '#4a4a7a', fontSize: 12, textDecorationLine: 'underline' },
});
