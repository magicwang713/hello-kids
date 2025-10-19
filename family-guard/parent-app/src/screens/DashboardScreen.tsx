import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Button, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { Session } from "@supabase/supabase-js";

import { supabase, callEdgeFunction } from "../api/supabase";
import { ChildProfile, DashboardData, RangeOption, AnomalyEvent } from "../types";
import { formatMinutesToH } from "../utils/format";
import UsageCard from "../components/UsageCard";
import NightChart from "../components/NightChart";

interface Props {
  session: Session;
  selectedChildId?: string | null;
  onChildChange?: (childId: string) => void;
  onChildrenLoaded?: (children: ChildProfile[]) => void;
  refreshKey?: number;
}

const ranges: RangeOption[] = ["7d", "30d"];

const DashboardScreen: React.FC<Props> = ({
  session,
  selectedChildId: selectedChildIdProp,
  onChildChange,
  onChildrenLoaded,
  refreshKey,
}) => {
  const { t, i18n } = useTranslation();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(selectedChildIdProp ?? null);
  const [range, setRange] = useState<RangeOption>("7d");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);

  useEffect(() => {
    loadChildren();
  }, [session.user?.id, refreshKey]);

  useEffect(() => {
    if (selectedChildIdProp && selectedChildIdProp !== selectedChildId) {
      setSelectedChildId(selectedChildIdProp);
    }
  }, [selectedChildIdProp, selectedChildId]);

  useEffect(() => {
    if (!selectedChildId) return;
    fetchDashboard(selectedChildId, range);
    const unsubscribe = subscribeAnomalies(selectedChildId);
    return () => {
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChildId, range, i18n.language]);

  const loadChildren = async () => {
    const { data, error } = await supabase
      .from<ChildProfile>("child_profiles")
      .select("id, child_name, tz, locale")
      .eq("parent_uid", session.user.id)
      .order("created_at", { ascending: true });
    if (error) {
      Alert.alert("Supabase", error.message);
      return;
    }
    setChildren(data ?? []);
    onChildrenLoaded?.(data ?? []);
    if (!selectedChildId && data && data.length > 0) {
      handleChildChange(data[0].id);
    }
  };

  const fetchDashboard = async (childId: string, window: RangeOption) => {
    setRefreshing(true);
    try {
      const result = await callEdgeFunction<DashboardData>("get_dashboard", {
        body: { child_id: childId, range: window },
      });
      setDashboard(result);
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const subscribeAnomalies = (childId: string) => {
    const channel = supabase
      .channel(`anomalies-${childId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "anomaly_events", filter: `child_id=eq.${childId}` },
        (payload) => {
          setAnomalies((prev) => [payload.new as AnomalyEvent, ...prev].slice(0, 20));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRefresh = () => {
    if (selectedChildId) {
      fetchDashboard(selectedChildId, range);
    }
  };

  const handleChildChange = (childId: string) => {
    setSelectedChildId(childId);
    onChildChange?.(childId);
  };

  const summaryCards = useMemo(() => {
    if (!dashboard) return null;
    return (
      <View style={styles.summaryBox}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("dashboard.totalTime")}</Text>
          <Text style={styles.summaryValue}>{formatMinutesToH(dashboard.summary.total_minutes)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("dashboard.nightTime")}</Text>
          <Text style={styles.summaryValue}>{formatMinutesToH(dashboard.summary.night_minutes)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("dashboard.risk")}</Text>
          <Text style={styles.summaryValue}>{dashboard.risk_score}</Text>
        </View>
      </View>
    );
  }, [dashboard, t]);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.title}>{t("dashboard.title")}</Text>
      <View style={styles.row}>
        {children.map((child) => (
          <Button key={child.id} title={child.child_name} onPress={() => handleChildChange(child.id)} color={selectedChildId === child.id ? "#4E6BFF" : undefined} />
        ))}
      </View>
      <View style={styles.row}>
        {ranges.map((option) => (
          <Button key={option} title={option.toUpperCase()} onPress={() => setRange(option)} color={range === option ? "#722ED1" : undefined} />
        ))}
      </View>

      {summaryCards}

      {dashboard ? (
        <View>
          <UsageCard totalMinutes={dashboard.summary.total_minutes} deltaMinutes={0} topApps={dashboard.top_apps} />
          <NightChart data={dashboard.night_series} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("dashboard.risk")}: {dashboard.risk_score}</Text>
            <Text style={styles.cardSubtitle}>{t("dashboard.signals")}</Text>
            {dashboard.top_signals.map((signal) => (
              <Text key={signal} style={styles.listItem}>• {signal}</Text>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("dashboard.tips")}</Text>
            <Text style={styles.listItem}>{t("dashboard.strong")}: {dashboard.tips.strong}</Text>
            <Text style={styles.listItem}>{t("dashboard.neutral")}: {dashboard.tips.neutral}</Text>
            <Text style={styles.listItem}>{t("dashboard.gentle")}: {dashboard.tips.gentle}</Text>
            <Text style={styles.cardSubtitle}>{t("dashboard.why")}</Text>
            <Text style={styles.listItem}>{dashboard.tips.why}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("dashboard.liveAlerts")}</Text>
            {anomalies.length === 0 ? (
              <Text style={styles.empty}>{t("dashboard.empty")}</Text>
            ) : (
              anomalies.map((event) => (
                <Text key={event.id} style={styles.listItem}>
                  {new Date(event.occurred_at).toLocaleString()} – {t(`anomalies.${event.event_type}`)}
                </Text>
              ))
            )}
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>{t("dashboard.empty")}</Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F2FA",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  summaryBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#777",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 14,
    marginBottom: 6,
  },
  empty: {
    fontSize: 14,
    color: "#888",
    paddingVertical: 12,
  },
});

export default DashboardScreen;
