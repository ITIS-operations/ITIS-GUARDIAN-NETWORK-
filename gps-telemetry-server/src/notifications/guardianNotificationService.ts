/**
 * ITIS GUARDIAN NETWORK — GUARDIAN NOTIFICATION ABSTRACTION
 * 
 * Supports pluggable notification delivery:
 * - Development: SIMULATED_NOTIFICATION
 * - Future Production: SMS_PROVIDER, EMAIL_PROVIDER, PUSH_PROVIDER
 */

import {
  GuardianNotificationPayload,
  NotificationProviderType,
  NotificationDeliveryResult
} from '../types/emergency.js';

export interface INotificationProvider {
  readonly providerType: NotificationProviderType;
  send(payload: GuardianNotificationPayload): Promise<NotificationDeliveryResult>;
}

/**
 * Development & Test Notification Provider
 * Records deliveries safely without incurring SMS/Email infrastructure costs.
 */
export class SimulatedNotificationProvider implements INotificationProvider {
  public readonly providerType: NotificationProviderType = 'SIMULATED_NOTIFICATION';
  private sentNotifications: Array<{ payload: GuardianNotificationPayload; result: NotificationDeliveryResult }> = [];

  public async send(payload: GuardianNotificationPayload): Promise<NotificationDeliveryResult> {
    const result: NotificationDeliveryResult = {
      success: true,
      deliveryId: `sim_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      provider: this.providerType,
      timestamp: new Date(),
      status: 'DELIVERED'
    };

    this.sentNotifications.push({ payload, result });
    return result;
  }

  public getSentNotifications() {
    return [...this.sentNotifications];
  }

  public clearHistory(): void {
    this.sentNotifications = [];
  }
}

/**
 * Production SMS Provider Interface Stub
 */
export class SmsNotificationProvider implements INotificationProvider {
  public readonly providerType: NotificationProviderType = 'SMS_PROVIDER';

  constructor(private config?: { apiKey?: string; senderId?: string }) {}

  public async send(payload: GuardianNotificationPayload): Promise<NotificationDeliveryResult> {
    // Production integration hook for Telco SMS Gateway / Twilio / Infobip
    return {
      success: true,
      deliveryId: `sms_${Date.now()}`,
      provider: this.providerType,
      timestamp: new Date(),
      status: 'QUEUED'
    };
  }
}

/**
 * Production Email Provider Interface Stub
 */
export class EmailNotificationProvider implements INotificationProvider {
  public readonly providerType: NotificationProviderType = 'EMAIL_PROVIDER';

  constructor(private config?: { apiKey?: string; smtpHost?: string }) {}

  public async send(payload: GuardianNotificationPayload): Promise<NotificationDeliveryResult> {
    // Production integration hook for SendGrid / AWS SES / Postmark
    return {
      success: true,
      deliveryId: `email_${Date.now()}`,
      provider: this.providerType,
      timestamp: new Date(),
      status: 'QUEUED'
    };
  }
}

/**
 * Production Mobile Push Provider Interface Stub
 */
export class PushNotificationProvider implements INotificationProvider {
  public readonly providerType: NotificationProviderType = 'PUSH_PROVIDER';

  constructor(private config?: { fcmKey?: string }) {}

  public async send(payload: GuardianNotificationPayload): Promise<NotificationDeliveryResult> {
    // Production integration hook for Firebase Cloud Messaging / Apple APNS
    return {
      success: true,
      deliveryId: `push_${Date.now()}`,
      provider: this.providerType,
      timestamp: new Date(),
      status: 'QUEUED'
    };
  }
}

/**
 * Authoritative Guardian Notification Dispatcher
 */
export class GuardianNotificationService {
  private providers = new Map<NotificationProviderType, INotificationProvider>();
  private activeProviderType: NotificationProviderType = 'SIMULATED_NOTIFICATION';
  private deliveryHistory: Array<{ payload: GuardianNotificationPayload; result: NotificationDeliveryResult }> = [];

  constructor(defaultProvider?: INotificationProvider) {
    const sim = defaultProvider || new SimulatedNotificationProvider();
    this.registerProvider(sim);
    this.registerProvider(new SmsNotificationProvider());
    this.registerProvider(new EmailNotificationProvider());
    this.registerProvider(new PushNotificationProvider());
    this.setActiveProvider(sim.providerType);
  }

  public registerProvider(provider: INotificationProvider): void {
    this.providers.set(provider.providerType, provider);
  }

  public setActiveProvider(type: NotificationProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Notification provider '${type}' is not registered.`);
    }
    this.activeProviderType = type;
  }

  public getActiveProviderType(): NotificationProviderType {
    return this.activeProviderType;
  }

  public async notifyGuardian(payload: GuardianNotificationPayload): Promise<NotificationDeliveryResult> {
    const provider = this.providers.get(this.activeProviderType);
    if (!provider) {
      const failedResult: NotificationDeliveryResult = {
        success: false,
        deliveryId: `fail_${Date.now()}`,
        provider: this.activeProviderType,
        timestamp: new Date(),
        status: 'FAILED',
        error: `Active provider '${this.activeProviderType}' is unavailable.`
      };
      return failedResult;
    }

    const result = await provider.send(payload);
    this.deliveryHistory.push({ payload, result });
    return result;
  }

  public getDeliveryHistory() {
    return [...this.deliveryHistory];
  }

  public getSimulatedProvider(): SimulatedNotificationProvider | undefined {
    const prov = this.providers.get('SIMULATED_NOTIFICATION');
    if (prov instanceof SimulatedNotificationProvider) {
      return prov;
    }
    return undefined;
  }

  public clearHistory(): void {
    this.deliveryHistory = [];
    this.getSimulatedProvider()?.clearHistory();
  }
}
