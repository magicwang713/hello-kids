import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { supabase } from "../api/supabase";

type Props = {
  onSignedIn: () => void;
};

const AuthScreen: React.FC<Props> = ({ onSignedIn }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert(t("auth.error"));
      return;
    }
    onSignedIn();
  };

  const handleMagic = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: "https://example.com" } });
    setLoading(false);
    if (error) {
      Alert.alert(t("auth.error"));
      return;
    }
    Alert.alert(t("auth.magicSent"));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("auth.title")}</Text>
      <TextInput
        placeholder={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        placeholder={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <Button title={loading ? t("app.loading") : t("auth.signIn")} onPress={handleSignIn} disabled={loading} />
      <View style={styles.spacer} />
      <Button title={t("auth.sendMagic")} onPress={handleMagic} disabled={loading || !email} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#F7F9FC",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  spacer: {
    height: 12,
  },
});

export default AuthScreen;
