import { StyleSheet, Text, type TextInputProps } from 'react-native';
import { TextField } from './TextField';

// 옛 화면용. Task 7 끝에서 사용처가 없으면 지운다.
export const Input = (props: TextInputProps) => <TextField autoCapitalize="none" autoCorrect={false} {...props} />;

export const ErrorText = ({ children }: { children?: string | null }) =>
  children ? <Text style={styles.error}>{children}</Text> : null;

export const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#111' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryText: { color: '#111', fontWeight: '600' },
  error: { color: '#c00' },
});
