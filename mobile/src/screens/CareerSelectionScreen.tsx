import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CareerSelection'>;

const CAREERS: string[] = [
  'Software Engineer',
  'Data Scientist',
  'UX Designer',
  'Product Manager',
  'Cybersecurity Analyst',
  'Entrepreneur',
  'Management Consultant',
  'Financial Analyst',
  'Marketing Manager',
  'Operations Manager',
  'Architect',
  'Journalist',
  'Graphic Designer',
  'Film/Media Director',
  'Game Developer',
  'Research Scientist',
  'Doctor / Physician',
  'Psychologist',
  'Environmental Scientist',
  'Biomedical Engineer',
];

const MAX_SELECTIONS = 8;

export default function CareerSelectionScreen({ navigation, route }: Props) {
  const { sessionId, scores } = route.params;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleCareer(career: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(career)) {
        next.delete(career);
      } else if (next.size < MAX_SELECTIONS) {
        next.add(career);
      }
      return next;
    });
  }

  function handleContinue() {
    if (selected.size === 0) return;
    navigation.replace('Report', {
      sessionId,
      scores,
      selectedCareers: Array.from(selected),
    });
  }

  function renderItem({ item }: { item: string }) {
    const isSelected = selected.has(item);
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleCareer(item)}
        activeOpacity={0.7}
      >
        {isSelected && (
          <Text style={styles.checkmark}>✓</Text>
        )}
        <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  }

  const canContinue = selected.size > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What careers interest you?</Text>
        <Text style={styles.subtitle}>
          Select up to 8 — we'll match them to your profile
        </Text>
        <Text style={styles.counter}>{selected.size} / {MAX_SELECTIONS} selected</Text>
      </View>

      <FlatList
        data={CAREERS}
        renderItem={renderItem}
        keyExtractor={item => item}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e0e0ff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#9999cc',
    textAlign: 'center',
    marginBottom: 8,
  },
  counter: {
    fontSize: 13,
    color: '#5c6bc0',
    textAlign: 'center',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  card: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    minHeight: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a4e',
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#5c6bc0',
    backgroundColor: '#1e2050',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 10,
    color: '#5c6bc0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardText: {
    color: '#9999cc',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardTextSelected: {
    color: '#e0e0ff',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  continueBtn: {
    backgroundColor: '#5c6bc0',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#2a2a4e',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
