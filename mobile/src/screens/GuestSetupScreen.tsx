/**
 * GuestSetupScreen
 * Shown after "Continue without login" on the Auth screen.
 * Collects name, age, and country, then launches the guest flow.
 */
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
import { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { guestStore } from '../services/guestStore';
import { COUNTRIES } from '../data/countries';

type Props = NativeStackScreenProps<AuthStackParamList, 'GuestSetup'>;

export default function GuestSetupScreen({ navigation: _nav }: Props) {
  const { continueAsGuest } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('India');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [error, setError] = useState('');

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase().trim();
    return q ? COUNTRIES.filter(c => c.toLowerCase().includes(q)) : COUNTRIES;
  }, [countrySearch]);

  function handleContinue() {
    if (!name.trim()) {
      setError('Please enter a name so we can personalise your report.');
      return;
    }
    setError('');
    guestStore.set({ name: name.trim(), age: age.trim(), country });
    continueAsGuest();
    // HomeScreen's useEffect detects isGuest + pending store → redirects to OccupationIntent
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={[]}
          renderItem={() => null}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={s.content}>
              <Text style={s.title}>Quick setup</Text>
              <Text style={s.subtitle}>
                Just a few details so we can personalise{'\n'}your results. No account needed.
              </Text>

              <Text style={s.label}>Your Name <Text style={s.req}>*</Text></Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Alex"
                placeholderTextColor="#5555aa"
                value={name}
                onChangeText={t => { setName(t); setError(''); }}
                autoCorrect={false}
                maxLength={50}
              />

              <Text style={s.label}>Age</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 25"
                placeholderTextColor="#5555aa"
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
                maxLength={3}
              />

              <Text style={s.label}>Country</Text>
              <TouchableOpacity
                style={s.pickerBtn}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={s.pickerBtnText}>{country}</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={s.btn} onPress={handleContinue} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue →</Text>
              </TouchableOpacity>

              <Text style={s.note}>
                Your data is only used to generate your report and is never shared.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>

      <Modal visible={showCountryPicker} animationType="slide" onRequestClose={() => setShowCountryPicker(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.searchInput}
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
                style={[s.listItem, country === item && s.listItemSelected]}
                onPress={() => { setCountry(item); setShowCountryPicker(false); setCountrySearch(''); }}
                activeOpacity={0.7}
              >
                <Text style={[s.listItemText, country === item && s.listItemTextSelected]}>{item}</Text>
                {country === item && <Text style={s.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#1a1a2e' },
  content:        { padding: 28, paddingBottom: 40 },
  title:          { fontSize: 26, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 10, textAlign: 'center' },
  subtitle:       { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 36 },
  label:          { color: '#c0c0ee', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  req:            { color: '#ef5350' },
  input: {
    backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a5e', color: '#e0e0ff', fontSize: 15,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 22,
  },
  pickerBtn: {
    backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a5e', paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 28,
  },
  pickerBtnText:  { color: '#e0e0ff', fontSize: 15, flex: 1 },
  chevron:        { color: '#5c6bc0', fontSize: 22 },
  error:          { color: '#ef5350', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  btn: {
    backgroundColor: '#5c6bc0', paddingVertical: 18,
    borderRadius: 30, alignItems: 'center', marginBottom: 20,
  },
  btnText:        { color: '#fff', fontSize: 17, fontWeight: '700' },
  note:           { color: '#4a4a7a', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  // Modal
  modal:          { flex: 1, backgroundColor: '#1a1a2e' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle:     { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', flex: 1 },
  closeBtn:       { padding: 6 },
  closeBtnText:   { color: '#9999cc', fontSize: 20 },
  searchInput: {
    backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a5e', color: '#e0e0ff', fontSize: 15,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 16, marginBottom: 12,
  },
  listItem:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  listItemSelected:   { backgroundColor: '#1e2050' },
  listItemText:       { color: '#c0c0ee', fontSize: 15, flex: 1 },
  listItemTextSelected:{ color: '#e0e0ff', fontWeight: '600' },
  checkmark:          { color: '#5c6bc0', fontSize: 18, fontWeight: 'bold' },
});
