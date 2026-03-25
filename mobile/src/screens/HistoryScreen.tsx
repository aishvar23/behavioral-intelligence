/**
 * History Screen
 * Shows previous session scores, trait trends, and performance graph.
 * Only accessible to authenticated users.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getUserHistory, SessionHistory, TraitPercentiles, TraitScores } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

// Max expected raw score per game type (mirrors backend GAME_MAX_SCORES)
const GAME_MAX: Record<string, number> = {
  rule_discovery: 240,
  planning:       240,
  memory:         150,
  logic:          105,
  reaction:       150,
  stroop:         360,
  matrix:         200,
  spatial:        160,
  estimation:     200,
  search:         200,
};

// Key traits to display in the trend chart
const CHART_TRAITS: { key: keyof TraitScores; label: string; color: string }[] = [
  { key: 'analytical_thinking', label: 'Analytical',  color: '#5c6bc0' },
  { key: 'working_memory',      label: 'Memory',      color: '#42a5f5' },
  { key: 'processing_speed',    label: 'Speed',       color: '#66bb6a' },
  { key: 'systematic_thinking', label: 'Systematic',  color: '#ffd54f' },
  { key: 'attention_to_detail', label: 'Attention',   color: '#ef9a9a' },
];

function scorePct(score: number, gameType: string): number {
  const max = GAME_MAX[gameType] ?? 150;
  return Math.min(100, Math.round((score / max) * 100));
}

function avgSessionPct(session: SessionHistory): number {
  if (!session.gameResults.length) return 0;
  const total = session.gameResults.reduce(
    (sum, g) => sum + scorePct(g.score, g.gameType),
    0
  );
  return Math.round(total / session.gameResults.length);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Trait bar row ────────────────────────────────────────────────────────────
function TraitBar({ label, value, color, percentile }: {
  label: string; value: number; color: string; percentile?: number | null;
}) {
  const pct = Math.round(value * 100);
  const topPct = percentile !== null && percentile !== undefined ? 100 - percentile : null;
  const pillColor = topPct !== null
    ? topPct <= 20 ? '#66bb6a' : topPct <= 40 ? '#42a5f5' : topPct <= 60 ? '#ffd54f' : '#ef9a9a'
    : null;
  return (
    <View style={tb.row}>
      <Text style={tb.label}>{label}</Text>
      <View style={tb.track}>
        <View style={[tb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={tb.val}>{pct}%</Text>
      {pillColor !== null && topPct !== null ? (
        <View style={[tb.pill, { backgroundColor: pillColor + '22', borderColor: pillColor }]}>
          <Text style={[tb.pillText, { color: pillColor }]}>
            {topPct <= 1 ? 'Top 1%' : `Top ${topPct}%`}
          </Text>
        </View>
      ) : <View style={tb.pillPlaceholder} />}
    </View>
  );
}

const tb = StyleSheet.create({
  row:            { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label:          { color: '#9999cc', fontSize: 12, width: 76 },
  track:          { flex: 1, height: 8, backgroundColor: '#2a2a5e', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  fill:           { height: 8, borderRadius: 4 },
  val:            { color: '#c0c0ee', fontSize: 12, width: 34, textAlign: 'right' },
  pill:           { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, marginLeft: 6 },
  pillText:       { fontSize: 9, fontWeight: '700' },
  pillPlaceholder:{ width: 54, marginLeft: 6 },
});

// ─── Session score history chart ──────────────────────────────────────────────
// Shows avg score % per session as vertical bars (newest on the right)
function ScoreHistoryChart({ sessions }: { sessions: SessionHistory[] }) {
  const displayed = [...sessions].reverse().slice(-8); // oldest first, up to 8
  const maxPct = Math.max(...displayed.map(avgSessionPct), 1);
  const BAR_H = 80;

  return (
    <View>
      <Text style={s.sectionTitle}>Score History</Text>
      <View style={chart.container}>
        {displayed.map((session, i) => {
          const pct = avgSessionPct(session);
          const barH = Math.max(4, Math.round((pct / 100) * BAR_H));
          const barColor = pct >= 70 ? '#66bb6a' : pct >= 45 ? '#5c6bc0' : '#ef9a9a';
          const d = new Date(session.createdAt);
          const label = `${d.getDate()}/${d.getMonth() + 1}`;
          return (
            <View key={session.sessionId + i} style={chart.col}>
              <Text style={chart.pctLabel}>{pct}%</Text>
              <View style={[chart.barWrap, { height: BAR_H }]}>
                <View style={[chart.bar, { height: barH, backgroundColor: barColor }]} />
              </View>
              <Text style={chart.dateLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chart = StyleSheet.create({
  container:  { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: 8 },
  col:        { flex: 1, alignItems: 'center' },
  barWrap:    { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar:        { width: '60%', borderRadius: 4, minHeight: 4 },
  pctLabel:   { color: '#5555aa', fontSize: 9, marginBottom: 2 },
  dateLabel:  { color: '#5555aa', fontSize: 9, marginTop: 4 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SessionHistory[]>([]);
  const [percentiles, setPercentiles] = useState<TraitPercentiles | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { history: data, currentPercentiles } = await getUserHistory();
      setHistory(data);
      setPercentiles(currentPercentiles ?? null);
    } catch {
      setError('Could not load history. Make sure you are connected.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#5c6bc0" />
        <Text style={s.loadingText}>Loading your history…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.8}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📊</Text>
        <Text style={s.emptyTitle}>No history yet</Text>
        <Text style={s.emptyDesc}>
          Complete an assessment to see your performance trends here.
        </Text>
        <TouchableOpacity style={s.startBtn} onPress={() => navigation.navigate('OccupationIntent')} activeOpacity={0.85}>
          <Text style={s.startBtnText}>Start Assessment →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const latestSession = history[0];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Score history chart ─────────────────────────────────────────── */}
      <View style={s.card}>
        <ScoreHistoryChart sessions={history} />
        <Text style={s.chartNote}>Average score % per session (oldest → newest)</Text>
      </View>

      {/* ── Latest trait breakdown ──────────────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Latest Trait Profile</Text>
        <Text style={s.cardSubtitle}>
          {latestSession.occupation} · {formatDate(latestSession.createdAt)}
          {percentiles && Object.values(percentiles).some(v => v !== null) ? '  ·  vs all users' : ''}
        </Text>
        {CHART_TRAITS.map(t => (
          <TraitBar
            key={t.key}
            label={t.label}
            value={latestSession.traits[t.key] ?? 0}
            color={t.color}
            percentile={percentiles?.[t.key] ?? null}
          />
        ))}
      </View>

      {/* ── Trait trend (latest vs oldest) ─────────────────────────────── */}
      {history.length >= 2 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Trait Trend</Text>
          <Text style={s.cardSubtitle}>Change from first to latest session</Text>
          {CHART_TRAITS.map(t => {
            const oldest = history[history.length - 1].traits[t.key] ?? 0;
            const latest = latestSession.traits[t.key] ?? 0;
            const delta = latest - oldest;
            const sign = delta >= 0 ? '+' : '';
            const col = delta > 0.02 ? '#66bb6a' : delta < -0.02 ? '#ef5350' : '#9999cc';
            return (
              <View key={t.key} style={trend.row}>
                <View style={[trend.dot, { backgroundColor: t.color }]} />
                <Text style={trend.label}>{t.label}</Text>
                <Text style={[trend.delta, { color: col }]}>
                  {sign}{Math.round(delta * 100)}%
                </Text>
                <Text style={trend.arrow}>
                  {delta > 0.02 ? '▲' : delta < -0.02 ? '▼' : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Past sessions list ──────────────────────────────────────────── */}
      <Text style={[s.sectionTitle, { marginHorizontal: 16, marginBottom: 8 }]}>
        Past Sessions ({history.length})
      </Text>
      {history.map((session, idx) => {
        const isExpanded = expandedIdx === idx;
        const avg = avgSessionPct(session);
        return (
          <TouchableOpacity
            key={session.sessionId}
            style={[s.card, { marginBottom: 10 }]}
            onPress={() => setExpandedIdx(isExpanded ? null : idx)}
            activeOpacity={0.85}
          >
            <View style={sess.header}>
              <View>
                <Text style={sess.date}>{formatDate(session.createdAt)}</Text>
                <Text style={sess.occupation}>{session.occupation}</Text>
              </View>
              <View style={sess.avgWrap}>
                <Text style={[sess.avgPct, { color: avg >= 70 ? '#66bb6a' : avg >= 45 ? '#5c6bc0' : '#ef9a9a' }]}>
                  {avg}%
                </Text>
                <Text style={sess.avgLabel}>avg score</Text>
              </View>
              <Text style={sess.chevron}>{isExpanded ? '▲' : '▼'}</Text>
            </View>

            {isExpanded && (
              <View style={sess.details}>
                <View style={sess.divider} />
                {session.gameResults.map(g => {
                  const pct = scorePct(g.score, g.gameType);
                  const max = GAME_MAX[g.gameType] ?? 150;
                  return (
                    <View key={g.configId} style={sess.gameRow}>
                      <Text style={sess.gameEmoji}>{g.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={sess.gameTitle}>{g.title}</Text>
                          <Text style={sess.gameScore}>{g.score} / {max} pts</Text>
                        </View>
                        <View style={sess.scoreTrack}>
                          <View style={[sess.scoreFill, {
                            width: `${pct}%` as any,
                            backgroundColor: pct >= 70 ? '#66bb6a' : pct >= 45 ? '#5c6bc0' : '#ef9a9a',
                          }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const trend = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot:   { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  label: { color: '#9999cc', fontSize: 13, flex: 1 },
  delta: { fontSize: 14, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  arrow: { color: '#5555aa', fontSize: 14, marginLeft: 6, minWidth: 14 },
});

const sess = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date:      { color: '#9999cc', fontSize: 12, marginBottom: 2 },
  occupation:{ color: '#c0c0ee', fontSize: 14, fontWeight: '600' },
  avgWrap:   { alignItems: 'center' },
  avgPct:    { fontSize: 22, fontWeight: 'bold' },
  avgLabel:  { color: '#5555aa', fontSize: 11 },
  chevron:   { color: '#5555aa', fontSize: 14, marginLeft: 8 },
  details:   { marginTop: 8 },
  divider:   { height: 1, backgroundColor: '#2a2a5e', marginBottom: 12 },
  gameRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  gameEmoji: { fontSize: 20, marginTop: 1 },
  gameTitle: { color: '#c0c0ee', fontSize: 13, flex: 1 },
  gameScore: { color: '#7777aa', fontSize: 12 },
  scoreTrack:{ height: 5, backgroundColor: '#2a2a5e', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  scoreFill: { height: 5, borderRadius: 3 },
});

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1a1a2e' },
  center:       { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingText:  { color: '#7777aa', fontSize: 14, marginTop: 16 },
  errorText:    { color: '#ef5350', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn:     { backgroundColor: '#5c6bc0', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyTitle:   { color: '#e0e0ff', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  emptyDesc:    { color: '#7777aa', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  startBtn:     { backgroundColor: '#5c6bc0', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 30 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card:         { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { color: '#e0e0ff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: '#5555aa', fontSize: 12, marginBottom: 14 },
  chartNote:    { color: '#3a3a6e', fontSize: 11, textAlign: 'center', marginTop: 4 },
});
