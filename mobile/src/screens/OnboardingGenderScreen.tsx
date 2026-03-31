import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useOnboarding } from '../context/OnboardingContext';
import { Gender } from '../types/onboarding';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingGender'>;

const OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male',       label: 'Male',       emoji: '♂️' },
  { value: 'female',     label: 'Female',     emoji: '♀️' },
  { value: 'non_binary', label: 'Non-binary', emoji: '⚧' },
];

export default function OnboardingGenderScreen({ navigation }: Props) {
  const { setGender } = useOnboarding();
  const [selected, setSelected] = useState<Gender | null>(null);

  function handleNext() {
    if (!selected) return;
    setGender(selected);
    navigation.navigate('OnboardingOccupation');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.step}>Step 2 of 3</Text>
      <Text style={styles.title}>How do you identify?</Text>
      <Text style={styles.subtitle}>Used to provide more relevant context in your behavioral report.</Text>

      <View style={styles.options}>
        {OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, selected === opt.value && styles.optionSelected]}
            onPress={() => setSelected(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionEmoji}>{opt.emoji}</Text>
            <Text style={[styles.optionText, selected === opt.value && styles.optionTextSelected]}>
              {opt.label}
            </Text>
            <View style={[styles.radio, selected === opt.value && styles.radioSelected]}>
              {selected === opt.value && <View style={styles.radioDot} />}
            </View>
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
  options: { width: '100%', gap: 14, marginBottom: 40 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a5e',
    padding: 18,
    gap: 14,
  },
  optionSelected: { backgroundColor: '#1e2050', borderColor: '#5c6bc0' },
  optionEmoji: { fontSize: 24, width: 32 },
  optionText: { color: '#9999cc', fontSize: 17, fontWeight: '600', flex: 1 },
  optionTextSelected: { color: '#e0e0ff' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#3a3a6e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#5c6bc0' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5c6bc0' },
  btn: { backgroundColor: '#5c6bc0', width: '100%', paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#2a2a4e' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
