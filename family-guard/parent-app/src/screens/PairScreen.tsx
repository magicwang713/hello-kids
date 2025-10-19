import React, { useState } from "react";
import { View, Text, StyleSheet, Button, TextInput, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";

import { callEdgeFunction } from "../api/supabase";
import { ChildProfile } from "../types";

type Props = {
  child?: ChildProfile | null;
  onRefresh: () => void;
};

type RegisterResponse = {
  ok: boolean;
  device_id: string;
  child_id: string;
};

const PairScreen: React.FC<Props> = ({ child, onRefresh }) => {
  const { t } = useTranslation();
  const [pairCode, setPairCode] = useState("");
  const [childName, setChildName] = useState(child?.child_name ?? "");
  const [loading, setLoading] = useState(false);

  const handleCopy = () => {
    if (!pairCode) return;
    Clipboard.setStringAsync(pairCode);
    Alert.alert(t("pair.copy"), pairCode);
  };

  const handleGenerate = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setPairCode(code);
  };

  const handleSubmit = async () => {
    if (!pairCode) {
      Alert.alert(t("pair.code"), t("pair.pasteInstructions"));
      return;
    }
    setLoading(true);
    try {
      const result = await callEdgeFunction<RegisterResponse>("register_device", {
        body: { pairing_code: pairCode, child_name: childName },
        method: "POST",
      });
      if (result?.ok) {
        Alert.alert(t("pair.success"));
        onRefresh();
      } else {
        Alert.alert("Error", JSON.stringify(result));
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("pair.title")}</Text>
      <Text style={styles.description}>{t("pair.description")}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>{t("pair.code")}</Text>
        <Text style={styles.code}>{pairCode || "------"}</Text>
        <View style={styles.row}>
          <Button title={t("pair.generate")!} onPress={handleGenerate} />
          <View style={styles.rowSpacer} />
          <Button title={t("pair.copy")!} onPress={handleCopy} disabled={!pairCode} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t("pair.childName")}</Text>
        <TextInput style={styles.input} value={childName} onChangeText={setChildName} placeholder={t("pair.childName")} />
        <Button title={loading ? t("app.loading") : t("pair.submit")} onPress={handleSubmit} disabled={loading} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F2F3F8",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  code: {
    fontSize: 36,
    letterSpacing: 4,
    marginVertical: 12,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowSpacer: {
    width: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
});

export default PairScreen;
