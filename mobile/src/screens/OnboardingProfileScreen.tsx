import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useOnboarding } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import { guestStore } from '../services/guestStore';
import { COUNTRIES } from '../data/countries';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingProfile'>;

export default function OnboardingProfileScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const { setName, setAge: setCtxAge, setCountry: setCtxCountry } = useOnboarding();

  // Prefill name: auth.displayName for authenticated, guestStore.get().name for guests
  const initialName = auth.displayName ?? guestStore.get()?.name ?? '';

  const [name, setNameLocal] = useState(initialName);
  const [age, setAgeLocal] = useState('');
  const [country, setCountryLocal] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [error, setError] = useState('');

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase().trim();
    return q ? COUNTRIES.filter(c => c.toLowerCase().includes(q)) : COUNTRIES;
  }, [countrySearch]);

  function handleNext() {
    if (!name.trim()) {
      setError('Please enter your name to continue.');
      return;
    }
    setError('');
    setName(name.trim());
    setCtxAge(age.trim());
    setCtxCountry(country);
    navigation.navigate('OnboardingGender');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          <Text style={styles.step}>Step 1 of 3</Text>
          <Text style={styles.title}>About You</Text>
          <Text style={styles.subtitle}>Help us personalise your assessment and report.</Text>

          {/* Name */}
          <Text style={styles.label}>
            Your Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex"
            placeholderTextColor="#5555aa"
            value={name}
            onChangeText={t => { setNameLocal(t); setError(''); }}
            autoCorrect={false}
            maxLength={50}
          />

          {/* Age (optional) */}
          <Text style={styles.label}>Age <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 26"
            placeholderTextColor="#5555aa"
            keyboardType="numeric"
            value={age}
            onChangeText={setAgeLocal}
            maxLength={3}
          />

          {/* Country (optional) */}
          <Text style={styles.label}>Country <Text style={styles.optional}>(optional)</Text></Text>
          <TouchableOpacity
            style={[styles.pickerBtn, country ? styles.pickerBtnSelected : null]}
            onPress={() => setShowCountryPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={country ? styles.pickerBtnText : styles.pickerPlaceholder}>
              {country || 'Select country…'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, !name.trim() && styles.btnDisabled]}
            onPress={handleNext}
            disabled={!name.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" onRequestClose={() => setShowCountryPicker(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity
              onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search countries…"
            placeholderTextColor="#5555aa"
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoFocus
          />
          <FlatList
            data={filteredCountries}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, country === item && styles.listItemSelected]}
                onPress={() => {
                  setCountryLocal(item);
                  setShowCountryPicker(false);
                  setCountrySearch('');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.listItemText, country === item && styles.listItemTextSelected]}>
                  {item}
                </Text>
                {country === item && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flex: 1, padding: 28, justifyContent: 'center' },
  step: { color: '#4a4a7a', fontSize: 12, marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#e0e0ff', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 36 },
  label: { color: '#c0c0ee', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  required: { color: '#ef5350' },
  optional: { color: '#5555aa', fontWeight: '400', fontSize: 12 },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    color: '#e0e0ff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
  },
  pickerBtn: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  pickerBtnSelected: { borderColor: '#5c6bc0' },
  pickerBtnText: { color: '#e0e0ff', fontSize: 15, flex: 1 },
  pickerPlaceholder: { color: '#5555aa', fontSize: 15, flex: 1 },
  chevron: { color: '#5c6bc0', fontSize: 22 },
  errorText: { color: '#ef5350', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  btn: {
    backgroundColor: '#5c6bc0',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#2a2a4e' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  // Modal
  modal: { flex: 1, backgroundColor: '#1a1a2e' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', flex: 1 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: '#9999cc', fontSize: 20 },
  searchInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    color: '#e0e0ff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3e',
  },
  listItemSelected: { backgroundColor: '#1e2050' },
  listItemText: { color: '#c0c0ee', fontSize: 15, flex: 1 },
  listItemTextSelected: { color: '#e0e0ff', fontWeight: '600' },
  checkmark: { color: '#5c6bc0', fontSize: 18, fontWeight: 'bold' },
});
