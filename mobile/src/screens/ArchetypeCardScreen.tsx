/**
 * Archetype Card Screen — The Verdict
 *
 * Final screen of the Cognitive Mirror flow.
 * Displays the LLM-generated Archetype Card with:
 *   - Archetype name + tagline
 *   - Professional alignment statement
 *   - Per-trait narratives with level badges
 *   - Trait Talk conflict insights
 *   - Development recommendations
 */

import React, { useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchetypeCard'>;

const LEVEL_COLORS: Record<string, string> = {
  Elite:       '#22c55e',
  Strong:      '#3b82f6',
  Developing:  '#f59e0b',
  Foundational:'#ef4444',
};

export default function ArchetypeCardScreen({ route, navigation }: Props) {
  const { archetype, profession, traitResults, traitTalk } = route.params;
  const { logout } = useAuth();

  const scrollRef = useRef<ScrollView>(null);

  const hasFlags = traitTalk.flags.length > 0;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* ── Header Card ── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>YOUR ARCHETYPE</Text>
        <Text style={styles.heroName}>{archetype.archetypeName}</Text>
        <Text style={styles.heroTagline}>{archetype.archetypeTagline}</Text>
        <View style={styles.professionPill}>
          <Text style={styles.professionPillText}>{profession}</Text>
        </View>
      </View>

      {/* ── Professional Alignment ── */}
      <Section title="Professional Alignment">
        <Text style={styles.alignmentText}>{archetype.professionalAlignment}</Text>
      </Section>

      {/* ── Trait Results Strip ── */}
      <Section title="Trait Scores">
        <View style={styles.traitStrip}>
          {traitResults.map(t => {
            const narrative = archetype.traitNarratives?.find(n => n.traitId === t.traitId);
            const level     = narrative?.level ?? (
              t.peakScore >= 85 ? 'Elite' : t.peakScore >= 70 ? 'Strong' : t.peakScore >= 50 ? 'Developing' : 'Foundational'
            );
            const color = LEVEL_COLORS[level] ?? '#9ca3af';
            return (
              <View key={t.traitId} style={styles.traitRow}>
                <View style={styles.traitRowLeft}>
                  <Text style={styles.traitRowId}>{t.traitId}</Text>
                  <View>
                    <Text style={styles.traitRowName}>{t.traitName}</Text>
                    <Text style={styles.traitRowMeta}>
                      Level {t.peakLevel} · Peak {Math.round(t.peakScore)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.levelBadge, { borderColor: color }]}>
                  <Text style={[styles.levelBadgeText, { color }]}>{level}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      {/* ── Cognitive Strengths ── */}
      <Section title="Cognitive Strengths">
        <Text style={styles.bodyText}>{archetype.strengthSummary}</Text>
      </Section>

      {/* ── Trait Narratives ── */}
      {archetype.traitNarratives?.length > 0 && (
        <Section title="Trait Insights">
          {archetype.traitNarratives.map(n => {
            const color = LEVEL_COLORS[n.level] ?? '#9ca3af';
            return (
              <View key={n.traitId} style={styles.narrativeCard}>
                <View style={styles.narrativeHeader}>
                  <Text style={styles.narrativeId}>{n.traitId}</Text>
                  <Text style={styles.narrativeName}>{n.traitName}</Text>
                  <View style={[styles.miniLevelBadge, { backgroundColor: color + '22', borderColor: color }]}>
                    <Text style={[styles.miniLevelText, { color }]}>{n.level}</Text>
                  </View>
                </View>
                <Text style={styles.narrativeText}>{n.narrative}</Text>
              </View>
            );
          })}
        </Section>
      )}

      {/* ── Development Area ── */}
      <Section title="Development Focus">
        <View style={styles.devBox}>
          <Text style={styles.devText}>{archetype.developmentArea}</Text>
        </View>
      </Section>

      {/* ── Trait Talk Insights ── */}
      {hasFlags && (
        <Section title="Trait Talk Findings">
          <Text style={styles.sectionNote}>
            Trait Talk cross-referenced your scores to detect cognitive patterns.
          </Text>
          {traitTalk.flags.map((flag, i) => {
            const severityColor = flag.severity === 'warning' ? '#ef4444' : flag.severity === 'caution' ? '#f59e0b' : '#3b82f6';
            return (
              <View key={i} style={[styles.flagCard, { borderLeftColor: severityColor }]}>
                <View style={styles.flagHeader}>
                  <Text style={[styles.flagName, { color: severityColor }]}>{flag.flag}</Text>
                  <View style={[styles.severityBadge, { backgroundColor: severityColor + '22' }]}>
                    <Text style={[styles.severityText, { color: severityColor }]}>{flag.severity.toUpperCase()}</Text>
                  </View>
                </View>
                {archetype.traitTalkInsights?.[i] && (
                  <Text style={styles.flagInsight}>{archetype.traitTalkInsights[i]}</Text>
                )}
              </View>
            );
          })}
          {!hasFlags && (
            <View style={styles.cleanCard}>
              <Text style={styles.cleanText}>✓  No conflicts detected — scores are internally consistent.</Text>
            </View>
          )}
        </Section>
      )}

      {/* ── Recommendations ── */}
      {archetype.recommendations?.length > 0 && (
        <Section title="Development Actions">
          {archetype.recommendations.map((r, i) => (
            <View key={i} style={styles.recCard}>
              <Text style={styles.recAction}>{r.action}</Text>
              <Text style={styles.recRationale}>{r.rationale}</Text>
            </View>
          ))}
        </Section>
      )}

      {/* ── Actions ── */}
      <TouchableOpacity
        style={styles.retakeBtn}
        onPress={() => navigation.replace('OccupationIntent')}
      >
        <Text style={styles.retakeBtnText}>New Assessment</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.homeBtnText}>Back to Home</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0e17' },
  content:   { padding: 20, paddingBottom: 40 },

  // Hero
  heroCard: {
    backgroundColor: '#1a1330', borderRadius: 18, padding: 24,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#7c3aed',
  },
  heroLabel:    { fontSize: 10, color: '#7c3aed', fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  heroName:     { fontSize: 26, fontWeight: '800', color: '#e0e0ff', textAlign: 'center', marginBottom: 8 },
  heroTagline:  { fontSize: 15, color: '#a78bfa', textAlign: 'center', lineHeight: 22, marginBottom: 14, fontStyle: 'italic' },
  professionPill: {
    backgroundColor: '#7c3aed22', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#7c3aed44',
  },
  professionPillText: { fontSize: 13, color: '#a78bfa', fontWeight: '600' },

  // Sections
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 13, color: '#7c3aed', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  sectionNote:  { fontSize: 12, color: '#6b7280', marginBottom: 10 },

  alignmentText: { fontSize: 15, color: '#d1d5db', lineHeight: 23 },
  bodyText:      { fontSize: 14, color: '#d1d5db', lineHeight: 22 },

  // Trait strip
  traitStrip: { gap: 8 },
  traitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1e1d2e', borderRadius: 10, padding: 12,
  },
  traitRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  traitRowId:    { fontSize: 11, color: '#7c3aed', fontWeight: '700', fontFamily: 'monospace', width: 32 },
  traitRowName:  { fontSize: 14, fontWeight: '600', color: '#e0e0ff' },
  traitRowMeta:  { fontSize: 11, color: '#6b7280', marginTop: 2 },
  levelBadge:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText:{ fontSize: 11, fontWeight: '700' },

  // Trait narratives
  narrativeCard: {
    backgroundColor: '#1e1d2e', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  narrativeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  narrativeId:     { fontSize: 11, color: '#7c3aed', fontWeight: '700', fontFamily: 'monospace' },
  narrativeName:   { fontSize: 14, fontWeight: '600', color: '#e0e0ff', flex: 1 },
  miniLevelBadge:  { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  miniLevelText:   { fontSize: 10, fontWeight: '700' },
  narrativeText:   { fontSize: 13, color: '#9ca3af', lineHeight: 19 },

  // Development
  devBox: {
    backgroundColor: '#1a1330', borderRadius: 12, padding: 16,
    borderLeftWidth: 3, borderLeftColor: '#f59e0b',
  },
  devText: { fontSize: 14, color: '#d1d5db', lineHeight: 22 },

  // Trait Talk
  flagCard: {
    backgroundColor: '#1e1d2e', borderRadius: 10, padding: 14,
    marginBottom: 10, borderLeftWidth: 3,
  },
  flagHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  flagName:      { fontSize: 14, fontWeight: '700', flex: 1 },
  severityBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  severityText:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  flagInsight:   { fontSize: 13, color: '#9ca3af', lineHeight: 19 },

  cleanCard: {
    backgroundColor: '#14231f', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#16a34a',
  },
  cleanText: { fontSize: 13, color: '#22c55e' },

  // Recommendations
  recCard: {
    backgroundColor: '#1e1d2e', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  recAction:    { fontSize: 14, fontWeight: '600', color: '#e0e0ff', marginBottom: 6 },
  recRationale: { fontSize: 13, color: '#9ca3af', lineHeight: 19 },

  // Buttons
  retakeBtn: {
    backgroundColor: '#7c3aed', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10,
  },
  retakeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  homeBtn: {
    backgroundColor: '#1e1d2e', borderRadius: 12, borderWidth: 1, borderColor: '#3d3a5c',
    paddingVertical: 14, alignItems: 'center',
  },
  homeBtnText: { color: '#9ca3af', fontWeight: '600', fontSize: 15 },
});
