import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { settingsFromApi, settingsToApi, type SettingsResponse } from '@/lib/settings-contract';

export interface Camera {
  id: string;
  name: string;
  rtsp_url: string;
  status: string;
  location?: string;
  sop_name?: string;
  snapshot_url?: string;
  last_seen?: string;
  zones?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AlertItem {
  review_status?: 'PENDING' | 'CONFIRMED' | 'DISMISSED';
  id: string;
  event_id: string;
  alert_type: string;
  status: string;
  severity?: string;
  sent_at: string;
  camera_id?: string;
  camera?: { name: string; location?: string };
  assignee_id?: string;
  assignee?: { name: string };
  snapshot_url?: string;
}

export interface Recording {
  id: string;
  camera_id: string;
  camera?: { name: string; location?: string };
  trigger: string;
  duration_sec: number | null;
  size_bytes: number | null;
  started_at: string;
  ended_at: string | null;
  filepath: string;
}

export interface Person {
  id: string;
  name: string;
  tag?: string;
  photo_url?: string;
  alert_message?: string;
  alert_enabled?: boolean;
  createdAt?: string;
}

export interface Zone {
  id: string;
  camera_id: string;
  polygon_points: any;
  rule_type: string;
  name?: string;
  camera?: Camera;
}

export interface Detection {
  id: string;
  camera_id: string;
  object_type: string;
  confidence: number;
  timestamp: string;
  snapshot_url?: string;
  camera?: { name: string; location?: string };
}

export interface FaceEvent {
  id: string;
  camera_id: string;
  person_id?: string;
  confidence: number;
  timestamp: string;
  person?: { name: string; tag?: string };
  camera?: { name: string };
}

export interface HourlyTrend {
  hour: string;
  count: number;
  persons: number;
  vehicles: number;
}

export interface AnalyticsSummary {
  totalDetections: number;
  totalAlerts: number;
  activeAlerts: number;
  totalCameras: number;
  onlineCameras: number;
  totalFaceEvents: number;
  knownFaces: number;
  unknownFaces: number;
  fps_average?: number;
  inference_latency?: number;
  byType: { type: string; count: number }[];
}


export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface StreamTestResult {
  ok: boolean;
  message: string;
  resolution: number[] | null;
  fps: number | null;
}

// ─── Cameras ─────────────────────────────────────────────────────────────────

export function useCameras() {
  return useQuery({
    queryKey: ['cameras'],
    queryFn: async () => {
      const { data } = await api.get<Camera[]>('/cameras');
      return data;
    },
  });
}

export function useCamera(id: string) {
  return useQuery({
    queryKey: ['cameras', id],
    queryFn: async () => {
      const { data } = await api.get<Camera>(`/cameras/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Camera>) => {
      const { data } = await api.post<Camera>('/cameras', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

export function useUpdateCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Camera> & { id: string }) => {
      const { data } = await api.patch<Camera>(`/cameras/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

export function useDeleteCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cameras/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

/** Test RTSP stream reachability via the AI Engine. */
export function useTestCameraConnection() {
  return useMutation({
    mutationFn: async ({ id, rtsp_url }: { id: string; rtsp_url?: string }) => {
      const { data } = await api.post<StreamTestResult>(
        `/cameras/${id}/test-connection`,
        rtsp_url ? { rtsp_url } : {},
      );
      return data;
    },
  });
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export function useAlerts(status?: string) {
  return useQuery({
    queryKey: ['alerts', status],
    queryFn: async () => {
      const { data } = await api.get<AlertItem[]>('/alerts', { params: status ? { status } : undefined });
      return data;
    },
  });
}

export function useActiveAlertCount() {
  return useQuery({
    queryKey: ['alerts', 'active-count'],
    queryFn: async () => {
      const { data } = await api.get<number>('/alerts/active-count');
      return data;
    },
  });
}

export function useUpdateAlertStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/alerts/${id}/status`, { status });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useAssignAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assigneeId }: { id: string; assigneeId: string }) => {
      const { data } = await api.patch(`/alerts/${id}/assign`, { assigneeId });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

// ─── Zones ───────────────────────────────────────────────────────────────────

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data } = await api.get<Zone[]>('/zones');
      return data;
    },
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { camera_id: string; polygon_points: any; rule_type: string; name?: string }) => {
      const { data } = await api.post<Zone>('/zones', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; polygon_points?: any; rule_type?: string; name?: string }) => {
      const { data } = await api.patch<Zone>(`/zones/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/zones/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  });
}

// ─── People / Faces ───────────────────────────────────────────────────────────

export function usePersons(tag?: string) {
  return useQuery({
    queryKey: ['persons', tag],
    queryFn: async () => {
      const { data } = await api.get<Person[]>('/faces/persons', { params: tag ? { tag } : undefined });
      return data;
    },
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; tag?: string; photo_url?: string; alert_message?: string; alert_enabled?: boolean; image_b64?: string }) => {
      const { data } = await api.post<Person>('/faces/persons', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Person> & { id: string }) => {
      const { data } = await api.patch<Person>(`/faces/persons/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/faces/persons/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ personId, imageB64 }: { personId: string; imageB64: string }) => {
      const { data } = await api.post(`/faces/persons/${personId}/upload-image`, { image_b64: imageB64 });
      return data;
    },
  });
}

// ─── Detections / Events ──────────────────────────────────────────────────────

export function useDetections(limit = 50) {
  return useQuery({
    queryKey: ['detections', limit],
    queryFn: async () => {
      const { data } = await api.get<Detection[]>('/events/detections', { params: { limit } });
      return data;
    },
  });
}

export const useRecentDetections = useDetections;

// ─── Analytics ────────────────────────────────────────────────────────────────

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<AnalyticsSummary>('/analytics/summary');
      return data;
    },
  });
}

export function useHourlyTrend(hours = 24) {
  return useQuery({
    queryKey: ['analytics', 'hourly-trend', hours],
    queryFn: async () => {
      const { data } = await api.get<HourlyTrend[]>('/analytics/hourly', { params: { hours } });
      return data;
    },
  });
}

export function useFaceEvents(limit = 50) {
  return useQuery({
    queryKey: ['faceEvents', limit],
    queryFn: async () => {
      const { data } = await api.get<FaceEvent[]>('/events/faces', { params: { limit } });
      return data;
    },
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ['users'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<User[]>('/users');
      return data;
    },
  });
}

export interface AppSettings {
  humanDetection?: boolean;
  vehicleDetection?: boolean;
  faceRecognition?: boolean;
  animalDetection?: boolean;
  objectTracking?: boolean;
  confidenceThreshold?: number;
  pushNotifications?: boolean;
  inAppAlerts?: boolean;
  emailAlerts?: boolean;
  soundAlerts?: boolean;
  intrusionCooldown?: string;
  unknownFaceCooldown?: string;
  maxAlertsPerHour?: string;
  autoDismissAfter?: string;
  backendUrl?: string;
  aiEngineUrl?: string;
  cacheUrl?: string;
  snapshotVolume?: string;
  [key: string]: any;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<SettingsResponse>('/settings');
      return settingsFromApi(data);
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AppSettings) => {
      const { data } = await api.patch<SettingsResponse>('/settings', settingsToApi(payload));
      return settingsFromApi(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function useAuthLogin() {
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const { data } = await api.post<{ access_token: string; user: User }>('/auth/login', payload);
      return data;
    },
  });
}

export function useAuthRegister() {
  return useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string }) => {
      const { data } = await api.post<{ access_token: string; user: User }>('/auth/register', payload);
      return data;
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (payload: { email: string }) => {
      await api.post('/auth/forgot-password', payload);
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (payload: { token: string; password: string }) => {
      await api.post('/auth/reset-password', payload);
    },
  });
}

export const useAuthForgotPassword = useForgotPassword;
export const useAuthResetPassword = useResetPassword;
export const useStats = useAnalyticsSummary;


// ─── Alert Rules ──────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  name: string;
  camera_id?: string;
  camera?: { name: string };
  object_type?: string;
  alert_type: string;
  severity: string;
  schedule_mode: 'ALWAYS' | 'SCHEDULED';
  cooldown_seconds: number;
  actions: string[];
  schedule_days?: string[];
  schedule_start_time?: string;
  schedule_end_time?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useAlertRules() {
  return useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const { data } = await api.get<AlertRule[]>('/alert-rules');
      return data;
    },
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AlertRule>) => {
      const { data } = await api.post<AlertRule>('/alert-rules', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

export function useUpdateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<AlertRule> & { id: string }) => {
      const { data } = await api.patch<AlertRule>(`/alert-rules/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/alert-rules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

// ─── Camera Groups ────────────────────────────────────────────────────────────

export interface CameraGroup {
  id: string;
  name: string;
  location?: string;
  cameras: { id: string; name: string; status?: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export function useCameraGroups() {
  return useQuery({
    queryKey: ['camera-groups'],
    queryFn: async () => {
      const { data } = await api.get<CameraGroup[]>('/camera-groups');
      return data;
    },
  });
}

export function useCreateCameraGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CameraGroup>) => {
      const { data } = await api.post<CameraGroup>('/camera-groups', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camera-groups'] }),
  });
}

export function useUpdateCameraGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CameraGroup> & { id: string }) => {
      const { data } = await api.patch<CameraGroup>(`/camera-groups/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camera-groups'] }),
  });
}

export function useDeleteCameraGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/camera-groups/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camera-groups'] }),
  });
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data } = await api.get<WebhookConfig[]>('/webhooks');
      return data;
    },
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<WebhookConfig>) => {
      const { data } = await api.post<WebhookConfig>('/webhooks', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<WebhookConfig> & { id: string }) => {
      const { data } = await api.patch<WebhookConfig>(`/webhooks/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/webhooks/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/webhooks/${id}/test`);
      return data;
    },
  });
}

// ─── Escalation Policies ──────────────────────────────────────────────────────

export interface EscalationStep {
  step_number: number;
  delay_min: number;
  channel: 'email' | 'sms' | 'webhook' | 'push';
  target: string;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  alert_type: string;
  min_severity: string;
  enabled: boolean;
  steps: EscalationStep[];
  createdAt?: string;
  updatedAt?: string;
}

export function useEscalationPolicies() {
  return useQuery({
    queryKey: ['escalation'],
    queryFn: async () => {
      const { data } = await api.get<EscalationPolicy[]>('/escalation');
      return data;
    },
  });
}

export function useCreateEscalationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EscalationPolicy>) => {
      const { data } = await api.post<EscalationPolicy>('/escalation', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation'] }),
  });
}

export function useUpdateEscalationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<EscalationPolicy> & { id: string }) => {
      const { data } = await api.patch<EscalationPolicy>(`/escalation/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation'] }),
  });
}

export function useDeleteEscalationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/escalation/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation'] }),
  });
}

// ─── Bulk Camera Import ───────────────────────────────────────────────────────

export function useBulkImportCameras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cameras: Partial<Camera>[]) => {
      const { data } = await api.post<{ created: number; errors: string[] }>('/cameras/bulk-import', { cameras });
      return { imported: data.created, failed: data.errors.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

// ─── Recordings ───────────────────────────────────────────────────────────────

export function useRecordings(limit = 100) {
  return useQuery({
    queryKey: ['recordings', limit],
    queryFn: async () => {
      const { data } = await api.get<Recording[]>('/recordings', { params: { limit } });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useDownloadRecording() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.get(`/recordings/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recording-${id}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  });
}
