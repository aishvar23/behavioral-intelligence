/**
 * Trait Discovery Screen
 *
 * Step 1 of the Cognitive Mirror flow.
 * User enters (or confirms) their target profession, we call the LLM to
 * discover the top 5 cognitive traits, then navigate to BaselineScreen.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { v4 as uuid } from 'uuid';
import { RootStackParamList } from '../navigation/AppNavigator';
import { discoverTraits, startAssessmentSession, DiscoveredTrait } from '../services/assessmentApi';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'TraitDiscovery'>;

export default function TraitDiscoveryScreen({ route, navigation }: Props) {
  const { auth } = useAuth();
  const initialProfession = route.params?.profession ?? '';

  const [profession, setProfession] = useState(initialProfession);
  const [loading, setLoading]       = useState(false);
  const [traits, setTraits]         = useState<DiscoveredTrait[] | null>(null);
  const [sessionId]                 = useState(() => uuid());
  const [error, setError]           = useState<string | null>(null);

  async function handleDiscover() {
    if (!profession.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const discovered = await discoverTraits(profession.trim(), sessionId);
      setTraits(discovered);
    } catch {
      setError('Could not analyse this profession — please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBegin() {
    if (!traits) return;
    setLoading(true);
    try {
      await startAssessmentSession(sessionId, profession.trim(), traits, auth.userId ?? undefined);
      navigation.navigate('Baseline', { sessionId, profession: profession.trim(), traits });
    } catch {
      setError('Failed to start assessment — please try again.');
    } finally {
      setLoading(false);
    }
  }

  const primary   = traits?.filter(t => t.isPrimary)   ?? [];
  const secondary = traits?.filter(t => !t.isPrimary)  ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>The Cognitive Mirror</Text>
      <Text style={styles.subtitle}>
        Enter your target profession and we'll map the cognitive traits that matter most.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Surgeon, Data Scientist, Air Traffic Controller…"
          placeholderTextColor="#6b7280"
          value={profession}
          onChangeText={t => { setProfession(t); setTraits(null); }}
          returnKeyType="search"
          onSubmitEditing={handleDiscover}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.analyseBtn, (!profession.trim() || loading) && styles.btnDisabled]}
          onPress={handleDiscover}
          disabled={!profession.trim() || loading}
        >
          <Text style={styles.analyseBtnText}>Analyse</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading && !traits && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#7c3aed" size="large" />
          <Text style={styles.loadingText}>Identifying cognitive traits…</Text>
        </View>
      )}

      {traits && (
        <View style={styles.traitsSection}>
          <Text style={styles.sectionTitle}>Your Assessment Profile</Text>
          <Text style={styles.sectionSub}>5 traits · 10 levels each · adaptive difficulty</Text>

          <Text style={styles.groupLabel}>● Primary Traits</Text>
          {primary.map(t => (
            <TraitCard key={t.id} trait={t} isPrimary />
          ))}

          <Text style={[styles.groupLabel, { marginTop: 16 }]}>◦ Secondary Traits</Text>
          {secondary.map(t => (
            <TraitCard key={t.id} trait={t} isPrimary={false} />
          ))}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Each trait is tested through 10 adaptive levels. The system adjusts
              difficulty in real-time — complete all 5 traits to receive your Archetype Card.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.beginBtn, loading && styles.btnDisabled]}
            onPress={handleBegin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.beginBtnText}>Begin Assessment →</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function TraitCard({ trait, isPrimary }: { trait: DiscoveredTrait; isPrimary: boolean }) {
  return (
    <View style={[styles.traitCard, isPrimary ? styles.traitCardPrimary : styles.traitCardSecondary]}>
      <View style={styles.traitHeader}>
        <Text style={styles.traitId}>{trait.id}</Text>
        <Text style={styles.traitName}>{trait.name}</Text>
        {isPrimary && <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>PRIMARY</Text></View>}
      </View>
      <Text style={styles.traitRelevance}>{trait.relevance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0e17' },
  content:   { padding: 20, paddingBottom: 60 },

  title:    { fontSize: 26, fontWeight: '700', color: '#e0e0ff', marginBottom: 8, marginTop: 12 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 24, lineHeight: 20 },

  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  input: {
    flex: 1, backgroundColor: '#1e1d2e', borderWidth: 1, borderColor: '#3d3a5c',
    borderRadius: 10, padding: 14, color: '#e0e0ff', fontSize: 15,
  },
  analyseBtn: {
    backgroundColor: '#7c3aed', borderRadius: 10, paddingHorizontal: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  analyseBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnDisabled:    { opacity: 0.4 },

  error: { color: '#f87171', fontSize: 13, marginBottom: 12 },

  loadingBox:  { alignItems: 'center', marginTop: 40, gap: 14 },
  loadingText: { color: '#9ca3af', fontSize: 14 },

  traitsSection: { marginTop: 8 },
  sectionTitle:  { fontSize: 18, fontWeight: '700', color: '#e0e0ff', marginBottom: 4 },
  sectionSub:    { fontSize: 12, color: '#7c3aed', marginBottom: 20, letterSpacing: 0.5 },

  groupLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },

  traitCard: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1,
  },
  traitCardPrimary:   { backgroundColor: '#1a1330', borderColor: '#7c3aed' },
  traitCardSecondary: { backgroundColor: '#161524', borderColor: '#3d3a5c' },

  traitHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  traitId:          { fontSize: 11, color: '#7c3aed', fontWeight: '700', fontFamily: 'monospace' },
  traitName:        { fontSize: 15, fontWeight: '600', color: '#e0e0ff', flex: 1 },
  primaryBadge:     { backgroundColor: '#7c3aed22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  primaryBadgeText: { fontSize: 9, color: '#a78bfa', fontWeight: '700', letterSpacing: 1 },

  traitRelevance: { fontSize: 13, color: '#9ca3af', lineHeight: 18 },

  infoBox: {
    backgroundColor: '#1e1d2e', borderRadius: 10, padding: 14,
    marginTop: 20, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#7c3aed',
  },
  infoText: { fontSize: 13, color: '#9ca3af', lineHeight: 19 },

  beginBtn: {
    backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginBottom: 20,
  },
  beginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
