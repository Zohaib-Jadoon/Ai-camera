import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Video, Shield, Bell, Activity } from 'lucide-react-native';

export default function Dashboard() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Shield size={32} color="#3b82f6" />
        <Text style={styles.title}>Madad Vision AI</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Video size={24} color="#3b82f6" />
          <Text style={styles.cardValue}>12 / 14</Text>
          <Text style={styles.cardLabel}>Active Cameras</Text>
        </View>
        <View style={styles.card}>
          <Activity size={24} color="#10b981" />
          <Text style={styles.cardValue}>1,284</Text>
          <Text style={styles.cardLabel}>Detections</Text>
        </View>
        <View style={styles.card}>
          <Bell size={24} color="#ef4444" />
          <Text style={styles.cardValue}>24</Text>
          <Text style={styles.cardLabel}>Alerts</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Incidents</Text>
      {[1, 2, 3, 4].map((i) => (
        <TouchableOpacity key={i} style={styles.incidentCard}>
          <View style={styles.incidentThumbnail} />
          <View>
            <Text style={styles.incidentText}>Human detected at Main Gate</Text>
            <Text style={styles.incidentTime}>2 minutes ago</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    itemsCenter: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#1e293b',
    width: '48%',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  cardValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  cardLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  incidentCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  incidentThumbnail: {
    width: 60,
    height: 40,
    backgroundColor: '#334155',
    borderRadius: 4,
    marginRight: 15,
  },
  incidentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  incidentTime: {
    color: '#64748b',
    fontSize: 12,
  },
});
