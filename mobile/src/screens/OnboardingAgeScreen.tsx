import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useOnboarding } from '../context/OnboardingContext';
import { AgeRange } from '../types/onboarding';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingAge'>;

const AGE_RANGES: AgeRange[] = ['< 18', '18-24', '25-34', '35-44', '45-54', '55+'];

export default function OnboardingAgeScreen({ navigation }: Props) {
  const { setAgeRange } = useOnboarding();
  const [selected, setSelected] = useState<AgeRange | null>(null);

  function handleNext() {
    if (!selected) return;
    setAgeRange(selected);
    navigation.navigate('OnboardingGender');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.step}>Step 1 of 3</Text>
      <Text style={styles.title}>How old are you?</Text>
      <Text style={styles.subtitle}>Helps us calibrate game difficulty and contextualise results.</Text>

      <View style={styles.grid}>
        {AGE_RANGES.map(range => (
          <TouchableOpacity
            key={range}
            style={[styles.option, selected === range && styles.optionSelected]}
            onPress={() => setSelected(range)}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionText, selected === range && styles.optionTextSelected]}>
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, !selected && styles.btnDisabled]}
        onPress={handleNext}
        disabled={!selected}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  step: { color: '#4a4a7a', fontSize: 12, marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '700', color: '#e0e0ff', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 36 },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 40 },
  option: {
    width: '44%',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: '#16213e',
    borderWidth: 1.5,
    borderColor: '#2a2a5e',
    alignItems: 'center',
  },
  optionSelected: { backgroundColor: '#2a2a6e', borderColor: '#5c6bc0' },
  optionText: { color: '#7777aa', fontSize: 16, fontWeight: '600' },
  optionTextSelected: { color: '#e0e0ff' },
  btn: { backgroundColor: '#5c6bc0', width: '100%', paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#2a2a4e' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
