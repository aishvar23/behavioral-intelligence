import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CareerRecommendation } from '../../services/api';

interface Props {
  item: CareerRecommendation;
}

const RATING_META: Record<CareerRecommendation['rating'], { color: string; label: string }> = {
  highly_recommended: { color: '#2e7d32', label: 'Highly Recommended' },
  recommended: { color: '#1565c0', label: 'Recommended' },
  neutral: { color: '#f57f17', label: 'Neutral' },
  not_recommended: { color: '#c62828', label: 'Not Recommended' },
};

export default function CareerCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = RATING_META[item.rating] ?? RATING_META.neutral;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        expanded && { borderColor: meta.color },
      ]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.careerName}>{item.career}</Text>
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Text style={styles.badgeText}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <Text style={styles.reason}>{item.reason}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#2a2a4e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginRight: 8,
  },
  careerName: {
    color: '#e0e0ff',
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    color: '#9999cc',
    fontSize: 12,
  },
  reason: {
    color: '#c0c0ee',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
});
