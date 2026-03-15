import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, UserProfile } from '../navigation/AppNavigator';
import {
  OCCUPATION_CATEGORY_LABELS,
  OccupationCategory,
  getOccupationsByCategory,
} from '../data/occupations';
import { GAME_CONFIGS } from '../data/gameCatalog';
import { selectGames } from '../services/api';
import { startSession } from '../services/session';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

const CATEGORIES_ORDER: OccupationCategory[] = [
  'technology', 'healthcare', 'business', 'education', 'legal', 'engineering', 'science', 'creative',
];

export default function UserProfileScreen({ navigation }: Props) {
  const [age, setAge] = useState('');
  const [interests, setInterests] = useState('');
  const [selectedOccupation, setSelectedOccupation] = useState<string | null>(null);
  const [occupationTitle, setOccupationTitle] = useState('');
  const [occupationEmoji, setOccupationEmoji] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectionReasoning, setSelectionReasoning] = useState('');
  const [error, setError] = useState('');

  const byCategory = useMemo(() => getOccupationsByCategory(), []);

  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    return CATEGORIES_ORDER.map(cat => ({
      title: OCCUPATION_CATEGORY_LABELS[cat],
      data: (byCategory[cat] ?? []).filter(o =>
        !q || o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
      ),
    })).filter(s => s.data.length > 0);
  }, [search, byCategory]);

  function handleSelectOccupation(id: string, title: string, emoji: string) {
    setSelectedOccupation(id);
    setOccupationTitle(title);
    setOccupationEmoji(emoji);
    setSelectionReasoning(''); // clear previous reasoning when occupation changes
    setShowPicker(false);
    setSearch('');
  }

  async function handleStart() {
    if (!selectedOccupation || selecting) return;
    setError('');
    setSelecting(true);

    const profile: UserProfile = {
      age: age.trim() || 'Not specified',
      occupation: selectedOccupation,
      occupationTitle,
      occupationEmoji,
      interests: interests.trim() || 'Not specified',
    };

    try {
      const { selectedIds, reasoning } = await selectGames(profile);
      setSelectionReasoning(reasoning);

      const sessionId = startSession();
      const gameQueue = selectedIds.map(id => {
        const cfg = GAME_CONFIGS[id];
        return {
          configId: id,
          gameType: cfg?.type ?? 'pattern',
          title: cfg?.title ?? id,
          emoji: cfg?.emoji ?? '🎮',
          description: cfg?.description ?? '',
        };
      });

      navigation.navigate('Game', {
        sessionId,
        userProfile: profile,
        gameQueue,
        currentIndex: 0,
        completedScores: [],
      });
    } catch {
      setError('Could not connect to the server. Please check your connection and try again.');
    } finally {
      setSelecting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={[]}
          renderItem={() => null}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.content}>
              <Text style={styles.title}>Tell us about yourself</Text>
              <Text style={styles.subtitle}>
                Our AI will select the right games for your occupation and personalise your report.
              </Text>

              {/* Age */}
              <Text style={styles.label}>Your Age</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 26"
                placeholderTextColor="#5555aa"
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
                maxLength={3}
              />

              {/* Occupation */}
              <Text style={styles.label}>
                Target / Current Occupation <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.pickerBtn, selectedOccupation && styles.pickerBtnSelected]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.8}
              >
                {selectedOccupation ? (
                  <Text style={styles.pickerBtnText}>{occupationEmoji}  {occupationTitle}</Text>
                ) : (
                  <Text style={styles.pickerPlaceholder}>Select your occupation…</Text>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>

              {/* Area of Interest */}
              <Text style={styles.label}>Area of Interest</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="e.g. Machine learning, public health, creative writing…"
                placeholderTextColor="#5555aa"
                value={interests}
                onChangeText={setInterests}
                multiline
                numberOfLines={3}
              />

              {/* Error */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* CTA */}
              <TouchableOpacity
                style={[styles.startBtn, (!selectedOccupation || selecting) && styles.startBtnDisabled]}
                onPress={handleStart}
                disabled={!selectedOccupation || selecting}
              >
                {selecting ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.startBtnText}>Selecting your games…</Text>
                  </View>
                ) : (
                  <Text style={styles.startBtnText}>Start Assessment →</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.note}>
                Our AI picks 3 games tailored to <Text style={styles.noteBold}>{occupationTitle || 'your occupation'}</Text>
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>

      {/* Occupation Picker Modal */}
      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Occupation</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search occupations…"
            placeholderTextColor="#5555aa"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <SectionList
            sections={filteredSections}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.occItem, selectedOccupation === item.id && styles.occItemSelected]}
                onPress={() => handleSelectOccupation(item.id, item.title, item.emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.occEmoji}>{item.emoji}</Text>
                <View style={styles.occText}>
                  <Text style={[styles.occTitle, selectedOccupation === item.id && styles.occTitleSelected]}>
                    {item.title}
                  </Text>
                  <Text style={styles.occDesc}>{item.description}</Text>
                </View>
                {selectedOccupation === item.id && <Text style={styles.checkmark}>✓</Text>}
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
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#7777aa', textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  label: { color: '#c0c0ee', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  required: { color: '#ef5350' },
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
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  pickerBtn: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  pickerBtnSelected: { borderColor: '#5c6bc0' },
  pickerBtnText: { color: '#e0e0ff', fontSize: 15, flex: 1 },
  pickerPlaceholder: { color: '#5555aa', fontSize: 15, flex: 1 },
  chevron: { color: '#5c6bc0', fontSize: 22 },
  errorText: { color: '#ef5350', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  startBtn: { backgroundColor: '#5c6bc0', paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginBottom: 16 },
  startBtnDisabled: { backgroundColor: '#2a2a4e' },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { color: '#4a4a7a', fontSize: 12, textAlign: 'center' },
  noteBold: { color: '#6a6aaa' },
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
  sectionHeader: { backgroundColor: '#0f1228', paddingHorizontal: 20, paddingVertical: 8 },
  sectionHeaderText: { color: '#5c6bc0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  occItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a3e', gap: 12 },
  occItemSelected: { backgroundColor: '#1e2050' },
  occEmoji: { fontSize: 24, width: 36 },
  occText: { flex: 1 },
  occTitle: { color: '#c0c0ee', fontSize: 15, fontWeight: '600' },
  occTitleSelected: { color: '#e0e0ff' },
  occDesc: { color: '#5555aa', fontSize: 12, marginTop: 2 },
  checkmark: { color: '#5c6bc0', fontSize: 18, fontWeight: 'bold' },
});
