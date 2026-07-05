export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SECURITY_OPERATOR' | 'VIEWER';
}

export interface Camera {
  id: string;
  name: string;
  rtsp_url: string;
  location?: string;
  status: 'ONLINE' | 'OFFLINE';
}

export interface Detection {
  id: string;
  camera_id: string;
  object_type: 'human' | 'car' | 'bike' | 'truck' | 'animal' | 'bird';
  confidence: number;
  timestamp: string;
  snapshot_url?: string;
}

export interface FaceEvent {
  id: string;
  camera_id: string;
  person_id?: string;
  person_name?: string;
  is_known: boolean;
  confidence: number;
  timestamp: string;
}
