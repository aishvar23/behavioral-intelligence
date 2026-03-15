import React, { useEffect, useRef, useState } from 'react';
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
import { RootStackParamList } from '../navigation/AppNavigator';
import { getCareerReport, FullReport, CareerRecommendation, GameObservation, SkillDevelopment } from '../services/api';
import CareerCard from '../components/report/CareerCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;

const TRAIT_META: Record<string, { label: string; color: string; emoji: string }> = {
  curiosity:       { label: 'Curiosity',       color: '#42a5f5', emoji: '🔭' },
  persistence:     { label: 'Persistence',     color: '#66bb6a', emoji: '💪' },
  risk_tolerance:  { label: 'Risk Tolerance',  color: '#ef5350', emoji: '⚡' },
  learning_speed:  { label: 'Learning Speed',  color: '#ab47bc', emoji: '🧠' },
};

const FIT_COLORS: Record<string, string> = {
  excellent: '#66bb6a',
  good: '#42a5f5',
  moderate: '#ffa726',
  low: '#ef5350',
};

const LOADING_MESSAGES = [
  'Analyzing your gameplay patterns…',
  'Calculating behavioral traits…',
  'Matching your profile to careers…',
  'Generating your behavioral report…',
  'Almost there…',
];

const REPORT_PIN = '0987654321';

export default function ReportScreen({ navigation, route }: Props) {
  const { sessionId, userProfile, gameResults } = route.params;
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const pinRef = useRef<TextInput>(null);

  useEffect(() => {
    let msgIndex = 0;
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2500);

    getCareerReport(sessionId, userProfile, gameResults)
      .then(setReport)
      .catch(() => setError('Failed to load your report. Please try again.'))
      .finally(() => { setLoading(false); clearInterval(interval); });

    return () => clearInterval(interval);
  }, []);

  function handlePinSubmit() {
    if (pinInput === REPORT_PIN) {
      setPinUnlocked(true);
    } else {
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 2000);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5c6bc0" />
        <Text style={styles.loadingText}>{loadingMsg}</Text>
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

  if (!pinUnlocked) {
    return (
      <View style={styles.center}>
        <Text style={styles.pinTitle}>Report Ready</Text>
        <Text style={styles.pinSubtitle}>
          This report is protected.{'\n'}Enter the PIN to view the results.
        </Text>
        <TextInput
          ref={pinRef}
          style={[styles.pinInput, pinError && styles.pinInputError]}
          value={pinInput}
          onChangeText={setPinInput}
          placeholder="Enter PIN"
          placeholderTextColor="#555577"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={10}
          onSubmitEditing={handlePinSubmit}
          autoFocus
        />
        {pinError && (
          <Text style={styles.pinErrorText}>Incorrect PIN. Please try again.</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handlePinSubmit}>
          <Text style={styles.buttonText}>Unlock Report</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* User Profile Banner */}
      <View style={styles.profileBanner}>
        <Text style={styles.profileEmoji}>{userProfile.occupationEmoji}</Text>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{userProfile.occupationTitle}</Text>
          <Text style={styles.profileMeta}>
            {userProfile.age !== 'Not specified' ? `Age ${userProfile.age}` : ''}
            {userProfile.age !== 'Not specified' && userProfile.interests !== 'Not specified' ? '  ·  ' : ''}
            {userProfile.interests !== 'Not specified' ? userProfile.interests : ''}
          </Text>
        </View>
      </View>

      {/* Game Scores */}
      <Text style={styles.sectionHeading}>Game Performance</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scoresScroll}>
        <View style={styles.scoresRow}>
          {gameResults.map(g => (
            <View key={g.configId} style={styles.scoreCard}>
              <Text style={styles.scoreEmoji}>{g.emoji}</Text>
              <Text style={styles.scoreLabel} numberOfLines={2}>{g.title}</Text>
              <Text style={styles.scoreValue}>{g.score}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Trait Bars */}
      <Text style={styles.sectionHeading}>Behavioral Traits</Text>
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
                  <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: meta.color }]} />
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

      {/* Behavioral Analysis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Behavioral Analysis</Text>
        <Text style={styles.sectionBody}>{report.aiReport}</Text>
      </View>

      {/* Occupation Fit */}
      {report.occupationFit && (
        <>
          <Text style={styles.sectionHeading}>Career Fit Assessment</Text>
          <View style={[styles.fitCard, { borderColor: FIT_COLORS[report.occupationFit.rating] ?? '#5c6bc0' }]}>
            <View style={styles.fitHeader}>
              <Text style={styles.fitOccupation}>{userProfile.occupationEmoji}  {userProfile.occupationTitle}</Text>
              <View style={[styles.fitBadge, { backgroundColor: FIT_COLORS[report.occupationFit.rating] + '33', borderColor: FIT_COLORS[report.occupationFit.rating] }]}>
                <Text style={[styles.fitBadgeText, { color: FIT_COLORS[report.occupationFit.rating] }]}>
                  {report.occupationFit.rating.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.fitSummary}>{report.occupationFit.summary}</Text>
          </View>
        </>
      )}

      {/* Game Observations */}
      {report.observations && report.observations.length > 0 && (
        <>
          <Text style={styles.sectionHeading}>What We Observed</Text>
          <Text style={styles.sectionSubtitle}>Factual observations from your gameplay</Text>
          {report.observations.map((obs: GameObservation, i: number) => (
            <View key={i} style={styles.observationCard}>
              <Text style={styles.observationGame}>{obs.game}</Text>
              <Text style={styles.observationText}>{obs.observation}</Text>
              <View style={styles.relevancePill}>
                <Text style={styles.relevanceText}>{obs.relevance}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Skill Development */}
      {report.skillDevelopment && report.skillDevelopment.length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { marginTop: 8 }]}>Skill Development</Text>
          <Text style={styles.sectionSubtitle}>Personalised activities to build your skills</Text>
          {report.skillDevelopment.map((item: SkillDevelopment, i: number) => (
            <View key={i} style={styles.skillCard}>
              <Text style={styles.skillName}>{item.skill}</Text>
              {item.activities.map((act, j) => (
                <View key={j} style={styles.activityRow}>
                  <Text style={styles.activityBullet}>•</Text>
                  <Text style={styles.activityText}>{act}</Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}

      {/* Recommended Careers */}
      {report.aiRecommendedCareers && report.aiRecommendedCareers.length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { marginTop: 20 }]}>✨ Also Recommended</Text>
          <Text style={styles.sectionSubtitle}>Careers that strongly match your behavioral profile</Text>
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
  loadingText: { color: '#9999cc', marginTop: 16, fontSize: 15, textAlign: 'center' },
  errorText: { color: '#ff6b6b', textAlign: 'center', fontSize: 16, marginBottom: 24 },
  button: { backgroundColor: '#5c6bc0', padding: 16, borderRadius: 30, alignItems: 'center', marginTop: 24, width: '100%' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // PIN gate
  pinTitle: { color: '#e0e0ff', fontSize: 22, fontWeight: '700', marginBottom: 10 },
  pinSubtitle: { color: '#9999cc', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  pinInput: { width: '100%', backgroundColor: '#16213e', borderWidth: 1.5, borderColor: '#2a2a5e', borderRadius: 14, padding: 16, fontSize: 22, color: '#e0e0ff', textAlign: 'center', letterSpacing: 6, marginBottom: 8 },
  pinInputError: { borderColor: '#ef5350' },
  pinErrorText: { color: '#ef5350', fontSize: 13, marginBottom: 8 },
  // Profile banner
  profileBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 24, gap: 14, borderWidth: 1, borderColor: '#2a2a5e' },
  profileEmoji: { fontSize: 36 },
  profileInfo: { flex: 1 },
  profileName: { color: '#e0e0ff', fontSize: 17, fontWeight: '700' },
  profileMeta: { color: '#6666aa', fontSize: 12, marginTop: 4, lineHeight: 18 },
  // Section headings
  sectionHeading: { fontSize: 17, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 10, marginTop: 8 },
  sectionSubtitle: { fontSize: 12, color: '#6666aa', marginBottom: 12 },
  // Game scores
  scoresScroll: { marginBottom: 24 },
  scoresRow: { flexDirection: 'row', gap: 10 },
  scoreCard: { width: 100, backgroundColor: '#16213e', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a5e' },
  scoreEmoji: { fontSize: 22, marginBottom: 6 },
  scoreLabel: { color: '#9999cc', fontSize: 10, textAlign: 'center', marginBottom: 6 },
  scoreValue: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold' },
  // Trait bars
  traitsSection: { marginBottom: 20, gap: 16 },
  traitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  traitEmoji: { fontSize: 22, width: 32 },
  traitInfo: { flex: 1 },
  traitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  traitLabel: { color: '#c0c0ee', fontSize: 14 },
  traitScore: { fontSize: 14, fontWeight: 'bold' },
  barTrack: { height: 8, backgroundColor: '#16213e', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  // Text sections
  section: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a5e' },
  sectionTitle: { color: '#5c6bc0', fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  sectionBody: { color: '#c0c0ee', fontSize: 14, lineHeight: 22 },
  // Occupation fit card
  fitCard: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1.5 },
  fitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fitOccupation: { color: '#e0e0ff', fontSize: 16, fontWeight: '700', flex: 1 },
  fitBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  fitBadgeText: { fontSize: 11, fontWeight: '700' },
  fitSummary: { color: '#c0c0ee', fontSize: 14, lineHeight: 22 },
  // Observations
  observationCard: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a5e' },
  observationGame: { color: '#5c6bc0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  observationText: { color: '#e0e0ff', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  relevancePill: { backgroundColor: '#1a1a40', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#5c6bc0' },
  relevanceText: { color: '#9999cc', fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  // Skill development
  skillCard: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a5e' },
  skillName: { color: '#66bb6a', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  activityRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  activityBullet: { color: '#66bb6a', fontSize: 14, lineHeight: 20 },
  activityText: { color: '#c0c0ee', fontSize: 14, lineHeight: 20, flex: 1 },
});
