export interface SettingsResponse {
  ai_enabled: boolean;
  confidence_threshold: number;
  notification_email: boolean;
  notification_push: boolean;
  notification_sms: boolean;
}

export function settingsFromApi(data: SettingsResponse) {
  return {
    aiEnabled: data.ai_enabled,
    confidenceThreshold: Math.round(data.confidence_threshold * 100),
    emailAlerts: data.notification_email,
    pushNotifications: data.notification_push,
    smsNotifications: data.notification_sms,
  };
}

export function settingsToApi(form: Record<string, unknown>): SettingsResponse {
  const threshold = form.confidenceThreshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error('Confidence threshold must be between 0 and 100 percent.');
  }
  for (const key of ['aiEnabled', 'emailAlerts', 'pushNotifications', 'smsNotifications']) {
    if (typeof form[key] !== 'boolean') throw new Error('Invalid notification or AI preference.');
  }
  // Never send UI-only fields or database metadata to a whitelist-validated DTO.
  return {
    ai_enabled: form.aiEnabled as boolean,
    confidence_threshold: threshold / 100,
    notification_email: form.emailAlerts as boolean,
    notification_push: form.pushNotifications as boolean,
    notification_sms: form.smsNotifications as boolean,
  };
}
