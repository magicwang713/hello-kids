import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { VictoryBar, VictoryChart, VictoryAxis, VictoryTheme } from "victory-native";
import { useTranslation } from "react-i18next";

import { DashboardTopApp } from "../types";
import { formatMinutesToH } from "../utils/format";

type Props = {
  totalMinutes: number;
  deltaMinutes?: number;
  topApps: DashboardTopApp[];
};

export const UsageCard: React.FC<Props> = ({ totalMinutes, deltaMinutes = 0, topApps }) => {
  const { t } = useTranslation();
  const arrow = deltaMinutes >= 0 ? "▲" : "▼";
  const deltaColor = deltaMinutes >= 0 ? styles.deltaUp : styles.deltaDown;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("dashboard.totalTime")}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.total}>{formatMinutesToH(totalMinutes)}</Text>
        <Text style={[styles.delta, deltaColor]}>
          {arrow} {Math.abs(deltaMinutes)} {t("common.minutes")}
        </Text>
      </View>
      <Text style={styles.subtitle}>{t("dashboard.signals")}</Text>
      {topApps.length === 0 ? (
        <Text style={styles.empty}>{t("dashboard.empty")}</Text>
      ) : (
        <VictoryChart height={220} padding={{ left: 60, right: 32, top: 24, bottom: 40 }} theme={VictoryTheme.material}>
          <VictoryAxis dependentAxis style={{ tickLabels: { fontSize: 10 } }} tickFormat={(value) => `${value}m`} />
          <VictoryAxis style={{ tickLabels: { fontSize: 10, angle: -30, padding: 20 } }} tickFormat={(value) => value.split(".").pop() ?? value} />
          <VictoryBar
            data={topApps.map((app) => ({
              x: app.app_id,
              y: app.minutes,
            }))}
            style={{ data: { fill: "#4E6BFF", width: 18 } }}
            cornerRadius={4}
          />
        </VictoryChart>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  total: {
    fontSize: 28,
    fontWeight: "700",
  },
  delta: {
    fontSize: 14,
    fontWeight: "500",
  },
  deltaUp: {
    color: "#FF7A45",
  },
  deltaDown: {
    color: "#52C41A",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    color: "#999",
  },
});

export default UsageCard;
