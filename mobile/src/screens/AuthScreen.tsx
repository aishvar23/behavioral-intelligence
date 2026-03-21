import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Auth'>;

export default function AuthScreen({ navigation }: Props) {
  const { continueAsGuest } = useAuth();

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.logo}>[BI]</Text>
        <Text style={styles.title}>Behavioral Intelligence</Text>
        <Text style={styles.tagline}>
          Play 5 personalised cognitive games.{'\n'}Discover your thinking style and career fit.
        </Text>
      </View>

      {/* Social buttons — disabled until Phase 6 */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.btnDisabled} disabled activeOpacity={1}>
          <Text style={styles.btnDisabledText}>Continue with Google  (Coming soon)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnDisabled} disabled activeOpacity={1}>
          <Text style={styles.btnDisabledText}>Continue with Facebook  (Coming soon)</Text>
        </TouchableOpacity>

        {/* Email sign-in */}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Sign in with Email</Text>
        </TouchableOpacity>

        {/* Register */}
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnOutlineText}>Create an account</Text>
        </TouchableOpacity>
      </View>

      {/* Guest path */}
      <TouchableOpacity onPress={continueAsGuest} activeOpacity={0.7}>
        <Text style={styles.guestLink}>Continue as Guest</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  hero: { alignItems: 'center', marginBottom: 44 },
  logo: { fontSize: 40, fontWeight: '900', color: '#5c6bc0', marginBottom: 16, letterSpacing: 2 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 14, textAlign: 'center' },
  tagline: { fontSize: 16, color: '#7777aa', textAlign: 'center', lineHeight: 24 },
  buttons: { width: '100%', gap: 12, marginBottom: 28 },
  btn: {
    backgroundColor: '#5c6bc0',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#5c6bc0',
  },
  btnOutlineText: { color: '#5c6bc0', fontSize: 16, fontWeight: '700' },
  btnDisabled: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#1e1e3a',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  btnDisabledText: { color: '#4a4a7a', fontSize: 15, fontWeight: '600' },
  guestLink: { color: '#7777aa', fontSize: 14, textDecorationLine: 'underline' },
});
