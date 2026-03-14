import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BehavioralReport } from '../../services/api';

interface Props {
  report: BehavioralReport;
}

const TRAIT_META: Record<string, { label: string; color: string; emoji: string }> = {
  curiosity: { label: 'Curiosity', color: '#42a5f5', emoji: '🔭' },
  persistence: { label: 'Persistence', color: '#66bb6a', emoji: '💪' },
  risk_tolerance: { label: 'Risk Tolerance', color: '#ef5350', emoji: '⚡' },
  learning_speed: { label: 'Learning Speed', color: '#ab47bc', emoji: '🧠' },
};

export default function BehavioralReportCard({ report }: Props) {
  return (
    <View>
      <Text style={styles.heading}>Your Behavioral Profile</Text>

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thinking Style</Text>
        <Text style={styles.sectionBody}>{report.thinkingStyle}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Behavioral Analysis</Text>
        <Text style={styles.sectionBody}>{report.aiReport}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e0e0ff',
    marginBottom: 20,
    textAlign: 'center',
  },
  traitsSection: { marginBottom: 24, gap: 16 },
  traitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  traitEmoji: { fontSize: 22, width: 32 },
  traitInfo: { flex: 1 },
  traitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  traitLabel: { color: '#c0c0ee', fontSize: 15 },
  traitScore: { fontSize: 15, fontWeight: 'bold' },
  barTrack: { height: 8, backgroundColor: '#16213e', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: '#5c6bc0', fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  sectionBody: { color: '#c0c0ee', fontSize: 15, lineHeight: 22 },
});
