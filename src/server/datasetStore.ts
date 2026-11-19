import fs from 'fs';
import path from 'path';
import { parseCSVRecords } from './csvParser';

export interface MessageRow {
  message_id: string;
  user_id: string;
  conversation_type: 'personal' | 'group' | 'business';
  group_id: string;
  business_id: string;
  sender_user_id: string;
  created_at: string;
  message_text: string;
  media_type: string;
  media_id: string;
  forwarded_count: number;
}

export interface SampleMessageRow extends MessageRow {
  action: 'notify' | 'digest' | 'mute';
  message_type: string;
  reason: string;
  confidence: number;
  evidence_message_ids: string;
}

export interface UserRow {
  user_id: string;
  do_not_disturb_window: string;
  messages_opened_30d: number;
  messages_replied_30d: number;
  notifications_dismissed_30d: number;
  messages_reported_30d: number;
}

export interface GroupRow {
  group_id: string;
  group_name: string;
  group_type: string;
  member_count: number;
  admin_count: number;
  created_at: string;
  messages_30d: number;
}

export interface GroupMemberRow {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  messages_sent_30d: number;
  messages_read_30d: number;
  replies_sent_30d: number;
  notifications_dismissed_30d: number;
  group_muted_by_user: boolean;
}

export interface BusinessAccountRow {
  business_id: string;
  display_name: string;
  brand_name: string;
  category: string;
  verified: boolean;
  official_domain: string;
  domain_used_by_sender: string;
  account_age_days: number;
  messages_sent_30d: number;
  user_reports_30d: number;
  domain_used_by_sender_age_days: number;
  domain_mismatch: boolean;
}

export interface UserBusinessHistoryRow {
  user_id: string;
  business_id: string;
  why_user_knows_account: string;
  last_activity_at: string;
  allows_promotions: boolean;
  promotions_opted_out_at: string;
  activity_count_180d: number;
  messages_opened_30d: number;
  messages_dismissed_30d: number;
  messages_replied_30d: number;
  last_reply_at: string;
}

export interface MessageEventRow {
  user_id: string;
  message_id: string;
  message_opened: boolean;
  message_replied: boolean;
  reaction_time_minutes: number | null;
  notification_dismissed: boolean;
  muted_after_message: boolean;
  message_reported: boolean;
}

export interface DailySummaryRow {
  user_id: string;
  date: string;
  notifications_sent: number;
  notifications_dismissed: number;
}

export interface MediaAssetRow {
  id: string;
  file_path: string;
  media_type: 'image' | 'voice';
}

export interface DatasetFileSummary {
  filename: string;
  rowCount: number;
  columns: string[];
  role: string;
}

const toInt = (v: string | undefined, fallback = 0): number => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const toFloat = (v: string | undefined, fallback = 0): number => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : fallback;
};

const toBool = (v: string | undefined): boolean => {
  return v === '1' || v?.toLowerCase() === 'true';
};

class DatasetStore {
  public messages: MessageRow[] = [];
  public sampleMessages: SampleMessageRow[] = [];
  public users: UserRow[] = [];
  public groups: GroupRow[] = [];
  public groupMembers: GroupMemberRow[] = [];
  public businessAccounts: BusinessAccountRow[] = [];
  public userBusinessHistory: UserBusinessHistoryRow[] = [];
  public messageHistory: MessageRow[] = [];
  public messageEvents: MessageEventRow[] = [];
  public dailySummary: DailySummaryRow[] = [];
  public images: MediaAssetRow[] = [];
  public voiceNotes: MediaAssetRow[] = [];
  public outputTemplateOrder: string[] = [];
  public fileSummaries: DatasetFileSummary[] = [];

  // Indexed maps for fast joins
  public usersById = new Map<string, UserRow>();
  public groupsById = new Map<string, GroupRow>();
  public groupMembersByKey = new Map<string, GroupMemberRow>();
  public businessesById = new Map<string, BusinessAccountRow>();
  public userBizByKey = new Map<string, UserBusinessHistoryRow>();
  public historyByUser = new Map<string, MessageRow[]>();
  public eventsByUserAndMsg = new Map<string, MessageEventRow>();
  public eventsByUser = new Map<string, MessageEventRow[]>();
  public dailyByUser = new Map<string, DailySummaryRow[]>();
  public imagesById = new Map<string, MediaAssetRow>();
  public voiceNotesById = new Map<string, MediaAssetRow>();
  public messagesById = new Map<string, MessageRow>();

  constructor() {
    this.loadAll();
  }

  private readCSVFile(canonicalName: string, fallbackAssetPrefix?: string): { records: Record<string, string>[]; columns: string[] } {
    const datasetDir = path.join(process.cwd(), 'dataset');
    let filePath = path.join(datasetDir, canonicalName);

    if (!fs.existsSync(filePath) && fallbackAssetPrefix) {
      const assetsDir = path.join(process.cwd(), 'public', 'assets', 'aistudio');
      if (fs.existsSync(assetsDir)) {
        const match = fs.readdirSync(assetsDir).find((f) => f.startsWith(fallbackAssetPrefix) && f.endsWith('.csv'));
        if (match) filePath = path.join(assetsDir, match);
      }
    }

    if (!fs.existsSync(filePath)) {
      console.warn(`[DatasetStore] File not found: ${canonicalName}`);
      return { records: [], columns: [] };
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const records = parseCSVRecords(raw);
    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    return { records, columns };
  }

  private parseMessageRow = (r: Record<string, string>): MessageRow => ({
    message_id: r.message_id || '',
    user_id: r.user_id || '',
    conversation_type: (r.conversation_type as MessageRow['conversation_type']) || 'personal',
    group_id: r.group_id || '',
    business_id: r.business_id || '',
    sender_user_id: r.sender_user_id || '',
    created_at: r.created_at || '',
    message_text: r.message_text || '',
    media_type: r.media_type || '',
    media_id: r.media_id || '',
    forwarded_count: toInt(r.forwarded_count, 0),
  });

  public loadAll(): void {
    const specs: Array<{ file: string; prefix: string; role: string }> = [
      { file: 'messages.csv', prefix: 'messages_', role: 'Incoming evaluation queue' },
      { file: 'sample_messages.csv', prefix: 'sample_messages_', role: 'Labeled ground-truth examples' },
      { file: 'users.csv', prefix: 'users_', role: 'User DND & 30d engagement profiles' },
      { file: 'groups.csv', prefix: 'groups_', role: 'Group metadata & activity' },
      { file: 'group_members.csv', prefix: 'group_members_', role: 'Roles, mute flags & reply rates' },
      { file: 'business_accounts.csv', prefix: 'business_accounts_', role: 'Brand verification & domain signals' },
      { file: 'user_business_history.csv', prefix: 'user_business_history_', role: 'Relationships & promo opt-outs' },
      { file: 'message_history.csv', prefix: 'message_history_', role: 'Past messages for evidence lookup' },
      { file: 'message_events.csv', prefix: 'message_events_', role: 'Open, reply, dismiss, mute & report flags' },
      { file: 'daily_notification_summary.csv', prefix: 'daily_notification_summary_', role: '14-day per-user load & fatigue' },
      { file: 'images.csv', prefix: 'images_', role: 'Image media registry' },
      { file: 'voice_notes.csv', prefix: 'voice_notes_', role: 'Voice note media registry' },
      { file: 'output.csv', prefix: 'output_', role: 'Submission output template' },
    ];

    this.fileSummaries = [];

    const loaded: Record<string, Record<string, string>[]> = {};
    for (const s of specs) {
      const { records, columns } = this.readCSVFile(s.file, s.prefix);
      loaded[s.file] = records;
      this.fileSummaries.push({
        filename: s.file,
        rowCount: records.length,
        columns,
        role: s.role,
      });
    }

    this.messages = loaded['messages.csv'].map(this.parseMessageRow);
    this.messages.forEach((m) => this.messagesById.set(m.message_id, m));

    this.sampleMessages = loaded['sample_messages.csv'].map((r) => ({
      ...this.parseMessageRow(r),
      action: (r.action as SampleMessageRow['action']) || 'digest',
      message_type: r.message_type || 'unknown',
      reason: r.reason || '',
      confidence: toFloat(r.confidence, 0.8),
      evidence_message_ids: r.evidence_message_ids || 'none',
    }));

    this.users = loaded['users.csv'].map((r) => ({
      user_id: r.user_id,
      do_not_disturb_window: r.do_not_disturb_window || '',
      messages_opened_30d: toInt(r.messages_opened_30d),
      messages_replied_30d: toInt(r.messages_replied_30d),
      notifications_dismissed_30d: toInt(r.notifications_dismissed_30d),
      messages_reported_30d: toInt(r.messages_reported_30d),
    }));
    this.users.forEach((u) => this.usersById.set(u.user_id, u));

    this.groups = loaded['groups.csv'].map((r) => ({
      group_id: r.group_id,
      group_name: r.group_name,
      group_type: r.group_type,
      member_count: toInt(r.member_count),
      admin_count: toInt(r.admin_count),
      created_at: r.created_at,
      messages_30d: toInt(r.messages_30d),
    }));
    this.groups.forEach((g) => this.groupsById.set(g.group_id, g));

    this.groupMembers = loaded['group_members.csv'].map((r) => ({
      group_id: r.group_id,
      user_id: r.user_id,
      role: r.role || 'member',
      joined_at: r.joined_at,
      messages_sent_30d: toInt(r.messages_sent_30d),
      messages_read_30d: toInt(r.messages_read_30d),
      replies_sent_30d: toInt(r.replies_sent_30d),
      notifications_dismissed_30d: toInt(r.notifications_dismissed_30d),
      group_muted_by_user: toBool(r.group_muted_by_user),
    }));
    this.groupMembers.forEach((gm) => this.groupMembersByKey.set(`${gm.group_id}::${gm.user_id}`, gm));

    this.businessAccounts = loaded['business_accounts.csv'].map((r) => {
      const verified = toBool(r.verified);
      const official = (r.official_domain || '').trim().toLowerCase();
      const used = (r.domain_used_by_sender || '').trim().toLowerCase();
      const domain_mismatch = Boolean(official && used && official !== used && !verified);
      return {
        business_id: r.business_id,
        display_name: r.display_name,
        brand_name: r.brand_name,
        category: r.category,
        verified,
        official_domain: official,
        domain_used_by_sender: used,
        account_age_days: toInt(r.account_age_days),
        messages_sent_30d: toInt(r.messages_sent_30d),
        user_reports_30d: toInt(r.user_reports_30d),
        domain_used_by_sender_age_days: toInt(r.domain_used_by_sender_age_days),
        domain_mismatch,
      };
    });
    this.businessAccounts.forEach((b) => this.businessesById.set(b.business_id, b));

    this.userBusinessHistory = loaded['user_business_history.csv'].map((r) => ({
      user_id: r.user_id,
      business_id: r.business_id,
      why_user_knows_account: r.why_user_knows_account || '',
      last_activity_at: r.last_activity_at || '',
      allows_promotions: toBool(r.allows_promotions),
      promotions_opted_out_at: r.promotions_opted_out_at || '',
      activity_count_180d: toInt(r.activity_count_180d),
      messages_opened_30d: toInt(r.messages_opened_30d),
      messages_dismissed_30d: toInt(r.messages_dismissed_30d),
      messages_replied_30d: toInt(r.messages_replied_30d),
      last_reply_at: r.last_reply_at || '',
    }));
    this.userBusinessHistory.forEach((ub) => this.userBizByKey.set(`${ub.user_id}::${ub.business_id}`, ub));

    this.messageHistory = loaded['message_history.csv'].map(this.parseMessageRow);
    this.messageHistory.forEach((m) => {
      const list = this.historyByUser.get(m.user_id) ?? [];
      list.push(m);
      this.historyByUser.set(m.user_id, list);
    });

    this.messageEvents = loaded['message_events.csv'].map((r) => ({
      user_id: r.user_id,
      message_id: r.message_id,
      message_opened: toBool(r.message_opened),
      message_replied: toBool(r.message_replied),
      reaction_time_minutes: r.reaction_time_minutes ? toFloat(r.reaction_time_minutes) : null,
      notification_dismissed: toBool(r.notification_dismissed),
      muted_after_message: toBool(r.muted_after_message),
      message_reported: toBool(r.message_reported),
    }));
    this.messageEvents.forEach((ev) => {
      this.eventsByUserAndMsg.set(`${ev.user_id}::${ev.message_id}`, ev);
      const list = this.eventsByUser.get(ev.user_id) ?? [];
      list.push(ev);
      this.eventsByUser.set(ev.user_id, list);
    });

    this.dailySummary = loaded['daily_notification_summary.csv'].map((r) => ({
      user_id: r.user_id,
      date: r.date,
      notifications_sent: toInt(r.notifications_sent),
      notifications_dismissed: toInt(r.notifications_dismissed),
    }));
    this.dailySummary.forEach((d) => {
      const list = this.dailyByUser.get(d.user_id) ?? [];
      list.push(d);
      this.dailyByUser.set(d.user_id, list);
    });

    this.images = loaded['images.csv'].map((r) => ({
      id: r.image_id,
      file_path: r.file_path,
      media_type: 'image',
    }));
    this.images.forEach((img) => this.imagesById.set(img.id, img));

    this.voiceNotes = loaded['voice_notes.csv'].map((r) => ({
      id: r.voice_note_id,
      file_path: r.file_path,
      media_type: 'voice',
    }));
    this.voiceNotes.forEach((vn) => this.voiceNotesById.set(vn.id, vn));

    this.outputTemplateOrder =
      loaded['output.csv'].length > 0
        ? loaded['output.csv'].map((r) => r.message_id).filter(Boolean)
        : this.messages.map((m) => m.message_id);

    console.log(
      `[DatasetStore] Loaded ${this.messages.length} messages, ${this.messageHistory.length} history rows, ${this.users.length} users, ${this.businessAccounts.length} businesses, ${this.groups.length} groups, ${this.sampleMessages.length} samples.`
    );
  }
}

export const datasetStore = new DatasetStore();
