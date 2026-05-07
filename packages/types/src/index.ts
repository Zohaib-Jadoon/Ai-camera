export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'SECURITY_OPERATOR' | 'VIEWER';
}

export interface Camera {
  id: string;
  name: string;
  rtsp_url: string;
  status: 'ONLINE' | 'OFFLINE';
  location?: string;
  group?: string;
}

export interface Zone {
  id: string;
  camera_id: string;
  name: string;
  polygon_points: { x: number; y: number }[];
  rule_type: 'HUMAN_ENTRY' | 'VEHICLE_ENTRY' | 'LOITERING' | 'CROSS_LINE';
}

export interface Detection {
  id: string;
  camera_id: string;
  object_type: 'human' | 'car' | 'bike' | 'animal' | 'bird' | 'truck';
  confidence: number;
  timestamp: string;
  snapshot_url?: string;
  bbox?: [number, number, number, number];
}

export interface Person {
  id: string;
  name: string;
  tag: 'EMPLOYEE' | 'FAMILY' | 'VISITOR' | 'VIP' | 'BLACKLISTED';
  face_embeddings?: number[][];
}

export interface FaceEvent {
  id: string;
  camera_id: string;
  person_id?: string;
  person_name?: string;
  is_known: boolean;
  confidence: number;
  timestamp: string;
  snapshot_url?: string;
}

export interface Alert {
  id: string;
  event_id: string;
  alert_type: 'INTRUSION' | 'UNKNOWN_PERSON' | 'WATCHLIST_PERSON' | 'LOITERING';
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
  camera_id: string;
  timestamp: string;
  snapshot_url?: string;
  confidence: number;
}

export interface AnalyticsData {
  totalDetections: number;
  activeAlerts: number;
  camerasOnline: number;
  intrusionEvents: number;
  detectionTrends: { timestamp: string; count: number }[];
  cameraActivity: { name: string; activity: number }[];
}
