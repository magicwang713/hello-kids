import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryLegend } from "victory-native";
import { useTranslation } from "react-i18next";

import { DashboardNightPoint } from "../types";

interface Props {
  data: DashboardNightPoint[];
}

export const NightChart: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("dashboard.nightTime")}</Text>
      {data.length === 0 ? (
        <Text style={styles.empty}>{t("dashboard.empty")}</Text>
      ) : (
        <VictoryChart theme={VictoryTheme.material} height={240} padding={{ left: 52, right: 32, top: 24, bottom: 40 }}>
          <VictoryLegend
            x={60}
            orientation="horizontal"
            gutter={20}
            data={[
              { name: "21-23", symbol: { fill: "#40A9FF" } },
              { name: "23-07", symbol: { fill: "#722ED1" } },
            ]}
          />
          <VictoryAxis tickFormat={(tick) => tick.split("-").slice(1).join("-") || tick} style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryAxis dependentAxis tickFormat={(value) => `${value}m`} style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryLine
            data={data.map((point) => ({ x: point.day, y: point.minutes_21_23 }))}
            style={{ data: { stroke: "#40A9FF", strokeWidth: 3 } }}
          />
          <VictoryLine
            data={data.map((point) => ({ x: point.day, y: point.minutes_23_07 }))}
            style={{ data: { stroke: "#722ED1", strokeWidth: 3 } }}
          />
        </VictoryChart>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    color: "#999",
  },
});

export default NightChart;
