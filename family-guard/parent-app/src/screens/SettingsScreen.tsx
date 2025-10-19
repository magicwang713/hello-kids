import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch, Button, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";

import { callEdgeFunction } from "../api/supabase";
import { supportedLocales, detectLocale } from "../i18n";
import { LANGUAGE_KEY, CONSENT_KEY, PUSH_TOKEN_KEY } from "../utils/storageKeys";

type Props = {
  childId?: string | null;
};

const SettingsScreen: React.FC<Props> = ({ childId }) => {
  const { t, i18n } = useTranslation();
  const [languageOverride, setLanguageOverride] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [consentRecorded, setConsentRecorded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const lang = await SecureStore.getItemAsync(LANGUAGE_KEY);
      if (lang) {
        setLanguageOverride(lang);
        i18n.changeLanguage(lang);
      }
      const consent = await SecureStore.getItemAsync(CONSENT_KEY);
      setConsentRecorded(consent);
      const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
      setNotificationsEnabled(Boolean(pushToken));
    })();
  }, [i18n]);

  const handleLanguageChange = async (lang: string | null) => {
    if (!lang) {
      await SecureStore.deleteItemAsync(LANGUAGE_KEY);
      const systemLang = detectLocale();
      await i18n.changeLanguage(systemLang);
      setLanguageOverride(null);
    } else {
      await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
      await i18n.changeLanguage(lang);
      setLanguageOverride(lang);
    }
  };

  const handleExport = async () => {
    if (!childId) return;
    Alert.alert(t("settings.export"), t("settings.confirmExport"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          await callEdgeFunction("export_delete", {
            body: { child_id: childId, action: "export" },
          });
        },
      },
    ]);
  };

  const handleDelete = async () => {
    if (!childId) return;
    Alert.alert(t("settings.delete"), t("settings.confirmDelete"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          await callEdgeFunction("export_delete", {
            body: { child_id: childId, action: "delete" },
          });
        },
      },
    ]);
  };

  const requestNotifications = async (value: boolean) => {
    if (!value) {
      setNotificationsEnabled(false);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Notifications", "Permission denied");
      return;
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    setNotificationsEnabled(true);
  };

  const recordConsent = async () => {
    const timestamp = new Date().toISOString();
    await SecureStore.setItemAsync(CONSENT_KEY, timestamp);
    setConsentRecorded(timestamp);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("settings.title")}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("settings.language")}</Text>
        <Button title={t("settings.followSystem")} onPress={() => handleLanguageChange(null)} />
        {supportedLocales.map((locale) => (
          <View key={locale} style={styles.languageRow}>
            <Text style={styles.languageLabel}>{locale}</Text>
            <Button
              title={languageOverride === locale ? t("common.ok") : t("common.confirm")}
              onPress={() => handleLanguageChange(locale)}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("settings.notifications")}</Text>
        <View style={styles.switchRow}>
          <Text>{notificationsEnabled ? t("common.ok") : t("common.cancel")}</Text>
          <Switch value={notificationsEnabled} onValueChange={requestNotifications} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("settings.export")}</Text>
        <Button title={t("settings.export")!} onPress={handleExport} disabled={!childId} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("settings.delete")}</Text>
        <Button title={t("settings.delete")!} onPress={handleDelete} color="#FF4D4F" disabled={!childId} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("settings.consent")}</Text>
        <Text style={styles.paragraph}>{t("app.consentBody")}</Text>
        <Button title={t("app.consentAgree")} onPress={recordConsent} />
        {consentRecorded && <Text style={styles.small}>{t("common.lastUpdated", { time: consentRecorded })}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F5F6FB",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  languageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  languageLabel: {
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paragraph: {
    fontSize: 14,
    marginBottom: 12,
  },
  small: {
    fontSize: 12,
    color: "#888",
    marginTop: 8,
  },
});

export default SettingsScreen;
