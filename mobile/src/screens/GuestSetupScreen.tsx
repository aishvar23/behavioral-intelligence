/**
 * GuestSetupScreen
 * Shown after "Continue without login" on the Auth screen.
 * Collects a display name, then hands off to the onboarding stem
 * (OnboardingAge → OnboardingGender → OnboardingEmployment).
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { guestStore } from '../services/guestStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'GuestSetup'>;

export default function GuestSetupScreen({ navigation: _nav }: Props) {
  const { continueAsGuest } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleContinue() {
    if (!name.trim()) {
      setError('Please enter a name so we can personalise your report.');
      return;
    }
    setError('');
    guestStore.set({ name: name.trim(), age: '', country: '' });
    continueAsGuest();
    // RootNavigator switches to AppStack → HomeScreen → user taps Begin Assessment
    // → OnboardingAge → OnboardingGender → OnboardingEmployment
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
        <View style={s.content}>
          <Text style={s.title}>Quick setup</Text>
          <Text style={s.subtitle}>
            Just your name to get started.{'\n'}No account needed.
          </Text>

          <Text style={s.label}>Your Name <Text style={s.req}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Alex"
            placeholderTextColor="#5555aa"
            value={name}
            onChangeText={t => { setName(t); setError(''); }}
            autoCorrect={false}
            autoFocus
            maxLength={50}
          />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={s.btn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={s.btnText}>Continue →</Text>
          </TouchableOpacity>

          <Text style={s.note}>
            Your data is only used to generate your report and is never shared.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#1a1a2e' },
  inner:   { flex: 1 },
  content: { flex: 1, padding: 28, paddingTop: 60, justifyContent: 'center' },
  title:   { fontSize: 26, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 10, textAlign: 'center' },
  subtitle:{ fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 36 },
  label:   { color: '#c0c0ee', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  req:     { color: '#ef5350' },
  input: {
    backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a5e', color: '#e0e0ff', fontSize: 15,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 22,
  },
  error:   { color: '#ef5350', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  btn: {
    backgroundColor: '#5c6bc0', paddingVertical: 18,
    borderRadius: 30, alignItems: 'center', marginBottom: 20,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  note:    { color: '#4a4a7a', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
