import { prisma } from "@/lib/db";

/**
 * 알림 설정 (싱글톤). 실제 이메일 발송 시 getNotificationSettings()로
 * adminEmail 및 각 notify* 플래그를 읽어 발송 여부를 결정하면 됩니다.
 */
export type NotificationSettings = {
  adminEmail: string | null;
  notifyNewRegistration: boolean;
  notifyRegistrationConfirmed: boolean;
  notifyPaymentConfirmed: boolean;
  notifyAnnouncement: boolean;
};

const DEFAULTS: NotificationSettings = {
  adminEmail: null,
  notifyNewRegistration: true,
  notifyRegistrationConfirmed: true,
  notifyPaymentConfirmed: true,
  notifyAnnouncement: true,
};

function dbRowToSettings(row: {
  adminEmail: string | null;
  notifyNewRegistration: boolean;
  notifyRegistrationConfirmed: boolean;
  notifyPaymentConfirmed: boolean;
  notifyAnnouncement: boolean;
}): NotificationSettings {
  return {
    adminEmail: row.adminEmail,
    notifyNewRegistration: row.notifyNewRegistration,
    notifyRegistrationConfirmed: row.notifyRegistrationConfirmed,
    notifyPaymentConfirmed: row.notifyPaymentConfirmed,
    notifyAnnouncement: row.notifyAnnouncement,
  };
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const row = await prisma.notificationSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!row) {
    const created = await prisma.notificationSetting.create({
      data: {
        adminEmail: DEFAULTS.adminEmail,
        notifyNewRegistration: DEFAULTS.notifyNewRegistration,
        notifyRegistrationConfirmed: DEFAULTS.notifyRegistrationConfirmed,
        notifyPaymentConfirmed: DEFAULTS.notifyPaymentConfirmed,
        notifyAnnouncement: DEFAULTS.notifyAnnouncement,
      },
    });
    return dbRowToSettings(created);
  }
  return dbRowToSettings(row);
}

export async function updateNotificationSettings(
  data: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const existing = await prisma.notificationSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!existing) {
    const created = await prisma.notificationSetting.create({
      data: {
        adminEmail: data.adminEmail ?? DEFAULTS.adminEmail,
        notifyNewRegistration: data.notifyNewRegistration ?? DEFAULTS.notifyNewRegistration,
        notifyRegistrationConfirmed: data.notifyRegistrationConfirmed ?? DEFAULTS.notifyRegistrationConfirmed,
        notifyPaymentConfirmed: data.notifyPaymentConfirmed ?? DEFAULTS.notifyPaymentConfirmed,
        notifyAnnouncement: data.notifyAnnouncement ?? DEFAULTS.notifyAnnouncement,
      },
    });
    return dbRowToSettings(created);
  }
  const updated = await prisma.notificationSetting.update({
    where: { id: existing.id },
    data: {
      ...(data.adminEmail !== undefined && { adminEmail: data.adminEmail }),
      ...(data.notifyNewRegistration !== undefined && {
        notifyNewRegistration: data.notifyNewRegistration,
      }),
      ...(data.notifyRegistrationConfirmed !== undefined && {
        notifyRegistrationConfirmed: data.notifyRegistrationConfirmed,
      }),
      ...(data.notifyPaymentConfirmed !== undefined && {
        notifyPaymentConfirmed: data.notifyPaymentConfirmed,
      }),
      ...(data.notifyAnnouncement !== undefined && {
        notifyAnnouncement: data.notifyAnnouncement,
      }),
    },
  });
  return dbRowToSettings(updated);
}
