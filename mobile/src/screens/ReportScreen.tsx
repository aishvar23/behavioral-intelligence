import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getCareerReport, FullReport, CareerRecommendation } from '../services/api';
import CareerCard from '../components/report/CareerCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;

const TRAIT_META: Record<string, { label: string; color: string; emoji: string }> = {
  curiosity: { label: 'Curiosity', color: '#42a5f5', emoji: '🔭' },
  persistence: { label: 'Persistence', color: '#66bb6a', emoji: '💪' },
  risk_tolerance: { label: 'Risk Tolerance', color: '#ef5350', emoji: '⚡' },
  learning_speed: { label: 'Learning Speed', color: '#ab47bc', emoji: '🧠' },
};

export default function ReportScreen({ navigation, route }: Props) {
  const { sessionId, scores, selectedCareers } = route.params;
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCareerReport(sessionId, selectedCareers, scores)
      .then(setReport)
      .catch(() => setError('Failed to load your report. Please try again.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5c6bc0" />
        <Text style={styles.loadingText}>Analyzing your behavior...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.popToTop()}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Game Scores Section */}
      <Text style={styles.sectionHeading}>Game Scores</Text>
      <View style={styles.scoresRow}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreEmoji}>🏝️</Text>
          <Text style={styles.scoreLabel}>Exploration</Text>
          <Text style={styles.scoreValue}>{report.gameScores.exploration}</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreEmoji}>🔍</Text>
          <Text style={styles.scoreLabel}>Pattern</Text>
          <Text style={styles.scoreValue}>{report.gameScores.pattern}</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreEmoji}>🧩</Text>
          <Text style={styles.scoreLabel}>Puzzle</Text>
          <Text style={styles.scoreValue}>{report.gameScores.puzzle}</Text>
        </View>
      </View>

      {/* Trait Bars */}
      <Text style={styles.sectionHeading}>Your Behavioral Profile</Text>
      <View style={styles.traitsSection}>
        {Object.entries(report.traits).map(([key, value]) => {
          const meta = TRAIT_META[key] ?? { label: key, color: '#9999cc', emoji: '📊' };
          const pct = Math.round(value * 100);
          return (
            <View key={key} style={styles.traitRow}>
              <Text style={styles.traitEmoji}>{meta.emoji}</Text>
              <View style={styles.traitInfo}>
                <View style={styles.traitHeader}>
                  <Text style={styles.traitLabel}>{meta.label}</Text>
                  <Text style={[styles.traitScore, { color: meta.color }]}>{pct}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Thinking Style */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thinking Style</Text>
        <Text style={styles.sectionBody}>{report.thinkingStyle}</Text>
      </View>

      {/* AI Analysis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Analysis</Text>
        <Text style={styles.sectionBody}>{report.aiReport}</Text>
      </View>

      {/* Career Matches */}
      <Text style={styles.sectionHeading}>Career Matches</Text>
      <Text style={styles.sectionSubtitle}>Based on your selected careers</Text>
      {report.careerRecommendations.map((item: CareerRecommendation) => (
        <CareerCard key={item.career} item={item} />
      ))}

      {/* AI Recommended Careers */}
      {report.aiRecommendedCareers && report.aiRecommendedCareers.length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { marginTop: 24 }]}>✨ AI Picks For You</Text>
          <Text style={styles.sectionSubtitle}>Careers you didn't select but strongly match your profile</Text>
          {report.aiRecommendedCareers.map((item: CareerRecommendation) => (
            <CareerCard key={`ai-${item.career}`} item={item} />
          ))}
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={() => navigation.popToTop()}>
        <Text style={styles.buttonText}>Play Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#9999cc', marginTop: 16, fontSize: 16 },
  errorText: { color: '#ff6b6b', textAlign: 'center', fontSize: 16, marginBottom: 24 },
  button: { backgroundColor: '#5c6bc0', padding: 16, borderRadius: 30, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e0e0ff',
    marginBottom: 6,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6666aa',
    marginBottom: 12,
  },

  // Game Scores
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 10,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  scoreEmoji: { fontSize: 24, marginBottom: 4 },
  scoreLabel: { color: '#9999cc', fontSize: 11, marginBottom: 6, textAlign: 'center' },
  scoreValue: { color: '#e0e0ff', fontSize: 22, fontWeight: 'bold' },

  // Trait bars
  traitsSection: { marginBottom: 20, gap: 16 },
  traitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  traitEmoji: { fontSize: 22, width: 32 },
  traitInfo: { flex: 1 },
  traitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  traitLabel: { color: '#c0c0ee', fontSize: 15 },
  traitScore: { fontSize: 15, fontWeight: 'bold' },
  barTrack: { height: 8, backgroundColor: '#16213e', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },

  // Text sections
  section: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: '#5c6bc0', fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  sectionBody: { color: '#c0c0ee', fontSize: 15, lineHeight: 22 },
});
