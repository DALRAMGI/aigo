import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>AIGO</Text>
      <Text style={styles.body}>사고 영상 분석 앱을 준비하고 있습니다.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#f2f1ee" },
  title: { fontSize: 32, fontWeight: "800", color: "#101014" },
  body: { fontSize: 15, color: "#101014" },
});
