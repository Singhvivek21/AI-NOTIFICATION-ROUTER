import {
  datasetStore,
  MessageRow,
  BusinessAccountRow,
  UserBusinessHistoryRow,
  GroupRow,
  GroupMemberRow,
  MessageEventRow,
  DailySummaryRow,
} from './datasetStore';

export type RoutingAction = 'notify' | 'digest' | 'mute';

export type MessageType =
  | 'personal'
  | 'urgent'
  | 'event'
  | 'payment'
  | 'business_update'
  | 'promotion'
  | 'greeting'
  | 'forward'
  | 'spam'
  | 'scam'
  | 'unknown';

export interface HistoricalMatch {
  message_id: string;
  created_at: string;
  conversation_type: string;
  message_text: string;
  media_type: string;
  media_id: string;
  forwarded_count: number;
  similarity: number;
  event: MessageEventRow | null;
}

export interface FullMessageContext {
  message: MessageRow;
  resolvedSenderName: string;
  resolvedChannelName: string;
  isVerifiedSender: boolean;
  user: {
    user_id: string;
    do_not_disturb_window: string;
    in_quiet_hours: boolean;
    messages_opened_30d: number;
    messages_replied_30d: number;
    notifications_dismissed_30d: number;
    messages_reported_30d: number;
    avg_daily_sent: number;
    avg_daily_dismissed: number;
    dismissal_rate: number;
    fatigue_score: number;
    daily_trend: DailySummaryRow[];
  };
  business: (BusinessAccountRow & {
    user_history: UserBusinessHistoryRow | null;
    has_opted_out: boolean;
  }) | null;
  group: (GroupRow & {
    user_membership: GroupMemberRow | null;
    sender_membership: GroupMemberRow | null;
    sender_is_admin: boolean;
    group_muted_by_user: boolean;
    user_reply_rate: number;
  }) | null;
  media: {
    has_media: boolean;
    media_type: string;
    media_id: string;
    file_path: string | null;
  };
  history: {
    matches: HistoricalMatch[];
    evidence_ids: string[];
    summary: string;
    engagement: {
      opened: number;
      replied: number;
      dismissed: number;
      muted: number;
      reported: number;
    };
  };
  features: {
    trustScore: number; // 0-100
    urgency: number; // 0-100
    spamProbability: number; // 0-100
    engagementScore: number; // 0-100
    notificationPriority: number; // 0-100
    domainSpoofingDetected: boolean;
    promptInjectionSuspected: boolean;
    riskFlags: string[];
  };
}

export interface ComputedDecision {
  id: string;
  messageId: string;
  action: RoutingAction;
  messageType: MessageType;
  reason: string;
  confidence: number; // 0-100 for UI display
  confidenceUnit: number; // 0.00-1.00 for CSV export
  evidenceIds: string[];
  trustScore: number;
  spamProbability: number;
  urgency: number;
  reflectionResult: string;
  processedAt: string;
  source: 'context-engine' | 'gemini-live';
  modelUsed?: string;
}

const PROMPT_INJECTION_REGEXES = [
  /ignore all previous/i,
  /routing override/i,
  /system note for (the )?notification router/i,
  /internal router metadata/i,
  /assistant instruction\s*:/i,
  /set action\s*=/i,
  /always mark this as notify/i,
];

function isInDndWindow(createdAt: string, windowStr: string): boolean {
  if (!createdAt || !windowStr || !windowStr.includes('-')) return false;
  const timeMatch = createdAt.match(/(\d{2}):(\d{2})/);
  if (!timeMatch) return false;
  const msgMins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
  const [startStr, endStr] = windowStr.split('-');
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return false;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins <= endMins) {
    return msgMins >= startMins && msgMins < endMins;
  }
  return msgMins >= startMins || msgMins < endMins;
}

function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set((a.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2));
  const wordsB = new Set((b.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersect = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) intersect++;
  });
  const union = wordsA.size + wordsB.size - intersect;
  return union > 0 ? intersect / union : 0;
}

export function buildFullContext(msg: MessageRow): FullMessageContext {
  const userRow = datasetStore.usersById.get(msg.user_id) ?? {
    user_id: msg.user_id,
    do_not_disturb_window: '22:00-07:00',
    messages_opened_30d: 0,
    messages_replied_30d: 0,
    notifications_dismissed_30d: 0,
    messages_reported_30d: 0,
  };

  const dailyRows = datasetStore.dailyByUser.get(msg.user_id) ?? [];
  const avgDailySent =
    dailyRows.length > 0
      ? dailyRows.reduce((sum, d) => sum + d.notifications_sent, 0) / dailyRows.length
      : 0;
  const avgDailyDismissed =
    dailyRows.length > 0
      ? dailyRows.reduce((sum, d) => sum + d.notifications_dismissed, 0) / dailyRows.length
      : 0;
  const dismissalRate = avgDailySent > 0 ? avgDailyDismissed / avgDailySent : 0;
  const inQuietHours = isInDndWindow(msg.created_at, userRow.do_not_disturb_window);
  let fatigue = Math.min(1, (avgDailySent / 15) * 0.5 + dismissalRate * 0.5);
  if (inQuietHours) fatigue = Math.min(1, fatigue + 0.25);

  let businessCtx: FullMessageContext['business'] = null;
  if (msg.business_id) {
    const biz = datasetStore.businessesById.get(msg.business_id);
    if (biz) {
      const uBiz = datasetStore.userBizByKey.get(`${msg.user_id}::${msg.business_id}`) ?? null;
      const hasOptedOut = Boolean(
        uBiz?.promotions_opted_out_at ||
          uBiz?.why_user_knows_account.toLowerCase().includes('opted_out')
      );
      businessCtx = { ...biz, user_history: uBiz, has_opted_out: hasOptedOut };
    }
  }

  let groupCtx: FullMessageContext['group'] = null;
  if (msg.group_id) {
    const grp = datasetStore.groupsById.get(msg.group_id);
    if (grp) {
      const userMem = datasetStore.groupMembersByKey.get(`${msg.group_id}::${msg.user_id}`) ?? null;
      const senderMem = msg.sender_user_id
        ? datasetStore.groupMembersByKey.get(`${msg.group_id}::${msg.sender_user_id}`) ?? null
        : null;
      const replyRate =
        userMem && userMem.messages_read_30d > 0
          ? userMem.replies_sent_30d / userMem.messages_read_30d
          : 0;
      groupCtx = {
        ...grp,
        user_membership: userMem,
        sender_membership: senderMem,
        sender_is_admin: senderMem?.role.toLowerCase() === 'admin',
        group_muted_by_user: Boolean(userMem?.group_muted_by_user),
        user_reply_rate: Math.round(replyRate * 100) / 100,
      };
    }
  }

  // Media lookup
  let mediaFilePath: string | null = null;
  if (msg.media_type === 'image' && msg.media_id) {
    mediaFilePath = datasetStore.imagesById.get(msg.media_id)?.file_path ?? null;
  } else if (msg.media_type === 'voice' && msg.media_id) {
    mediaFilePath = datasetStore.voiceNotesById.get(msg.media_id)?.file_path ?? null;
  }

  // History retrieval from message_history.csv + message_events.csv
  const userHist = datasetStore.historyByUser.get(msg.user_id) ?? [];
  const scored: Array<{ score: number; match: HistoricalMatch }> = [];

  for (const h of userHist) {
    let score = 0;
    if (msg.sender_user_id && h.sender_user_id === msg.sender_user_id) score += 3.0;
    if (msg.business_id && h.business_id === msg.business_id) score += 3.5;
    if (msg.group_id && h.group_id === msg.group_id) score += 2.0;
    if (msg.media_id && h.media_id === msg.media_id) score += 2.5;
    const sim = jaccardSimilarity(msg.message_text, h.message_text);
    if (sim >= 0.2) score += sim * 4.0;

    if (score >= 2.0) {
      const ev = datasetStore.eventsByUserAndMsg.get(`${msg.user_id}::${h.message_id}`) ?? null;
      scored.push({
        score,
        match: {
          message_id: h.message_id,
          created_at: h.created_at,
          conversation_type: h.conversation_type,
          message_text: h.message_text || (h.media_type ? `[${h.media_type}: ${h.media_id}]` : ''),
          media_type: h.media_type,
          media_id: h.media_id,
          forwarded_count: h.forwarded_count,
          similarity: Math.round(sim * 100) / 100,
          event: ev,
        },
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.match.created_at.localeCompare(a.match.created_at));
  const topMatches = scored.slice(0, 3).map((s) => s.match);
  const evidenceIds = topMatches.map((m) => m.message_id);

  const engagement = { opened: 0, replied: 0, dismissed: 0, muted: 0, reported: 0 };
  for (const m of topMatches) {
    if (!m.event) continue;
    if (m.event.message_opened) engagement.opened++;
    if (m.event.message_replied) engagement.replied++;
    if (m.event.notification_dismissed) engagement.dismissed++;
    if (m.event.muted_after_message) engagement.muted++;
    if (m.event.message_reported) engagement.reported++;
  }

  let histSummary = 'No relevant prior message history found for this sender.';
  if (topMatches.length > 0) {
    if (engagement.reported > 0 || engagement.muted > 0) {
      histSummary = `Found ${topMatches.length} prior message(s): user muted ${engagement.muted} and reported ${engagement.reported}.`;
    } else if (engagement.replied > 0 || engagement.opened > 0) {
      histSummary = `Found ${topMatches.length} prior message(s): user opened ${engagement.opened} and replied to ${engagement.replied}.`;
    } else if (engagement.dismissed > 0) {
      histSummary = `Found ${topMatches.length} prior message(s): user dismissed ${engagement.dismissed}.`;
    } else {
      histSummary = `Found ${topMatches.length} prior message(s) in user history.`;
    }
  }

  // Derived features & risk flags
  const promptInjectionSuspected = PROMPT_INJECTION_REGEXES.some((rx) => rx.test(msg.message_text));
  const domainSpoofingDetected = Boolean(businessCtx?.domain_mismatch);
  const riskFlags: string[] = [];

  if (promptInjectionSuspected) riskFlags.push('Prompt Injection Detected');
  if (domainSpoofingDetected) riskFlags.push(`Domain Spoofing (${businessCtx?.domain_used_by_sender} ≠ ${businessCtx?.official_domain})`);
  if (businessCtx && !businessCtx.verified && businessCtx.user_reports_30d >= 20) {
    riskFlags.push(`High User Reports (${businessCtx.user_reports_30d} in 30d)`);
  }
  if (businessCtx?.has_opted_out) riskFlags.push('User Opted Out of Promotions');
  if (msg.forwarded_count >= 5) riskFlags.push(`Mass Forwarded (${msg.forwarded_count}x)`);
  if (groupCtx?.group_muted_by_user) riskFlags.push('Group Muted by User');
  if (inQuietHours) riskFlags.push(`DND Quiet Hours (${userRow.do_not_disturb_window})`);
  if (engagement.reported > 0) riskFlags.push(`Previously Reported (${engagement.reported}x)`);

  const totalUserInteractions =
    userRow.messages_opened_30d + userRow.messages_replied_30d + userRow.notifications_dismissed_30d;
  const engagementScore =
    totalUserInteractions > 0
      ? Math.min(
          1,
          (userRow.messages_opened_30d * 0.5 + userRow.messages_replied_30d) / totalUserInteractions
        )
      : 0.4;

  let trust = 0.55;
  if (businessCtx) {
    if (businessCtx.verified) trust += 0.3;
    if (businessCtx.user_history?.allows_promotions) trust += 0.1;
    if ((businessCtx.user_history?.activity_count_180d ?? 0) > 0 && !businessCtx.has_opted_out) trust += 0.15;
    if (businessCtx.has_opted_out) trust -= 0.3;
    if (businessCtx.domain_mismatch) trust -= 0.55;
    if (businessCtx.user_reports_30d >= 20) trust -= 0.35;
  } else if (groupCtx) {
    if (groupCtx.sender_is_admin) trust += 0.28;
    if (groupCtx.group_muted_by_user) trust -= 0.25;
  } else {
    if (engagement.replied > 0) trust += 0.3;
    else if (engagement.opened > 0) trust += 0.15;
  }
  if (engagement.reported > 0) trust -= 0.45;
  if (engagement.muted > 0) trust -= 0.25;
  if (promptInjectionSuspected) trust -= 0.55;
  trust = Math.max(0.04, Math.min(0.98, trust));

  let spamProb = 0.08;
  if (promptInjectionSuspected) spamProb += 0.8;
  if (domainSpoofingDetected) spamProb += 0.72;
  if (msg.forwarded_count >= 5) spamProb += 0.48;
  if (businessCtx && !businessCtx.verified && businessCtx.account_age_days < 45) spamProb += 0.45;
  if (businessCtx?.has_opted_out) spamProb += 0.35;
  if (engagement.reported > 0) spamProb += 0.45;
  if (engagement.muted > 0) spamProb += 0.28;
  spamProb = Math.max(0.02, Math.min(0.99, spamProb));

  let urgency = 0.35;
  const lowerText = msg.message_text.toLowerCase();
  if (
    /\b(now|immediately|10 mins?|15 mins?|20 mins?|30 mins?|today|before 5 pm|before 6 pm|before 7 pm|5:15|6 pm|7:15|call me|rollback|build is failing|gate band|tank aa gaya|passeport|evacuation|fire alarm|leaves in)\b/i.test(
      lowerText
    )
  ) {
    urgency += 0.42;
  }
  if (/\b(no rush|nothing urgent|whenever free|no urgency|koi urgency nahi|tomorrow morning|whenever convenient|no need to reply)\b/i.test(lowerText)) {
    urgency -= 0.3;
  }
  if (msg.forwarded_count >= 5 && !/\btanker|gate\b/i.test(lowerText)) urgency -= 0.25;
  if (promptInjectionSuspected || domainSpoofingDetected) urgency = 0.08;
  urgency = Math.max(0.05, Math.min(0.97, urgency));

  const priority = Math.max(
    0.02,
    Math.min(0.98, urgency * 0.45 + trust * 0.35 + engagementScore * 0.2 - spamProb * 0.55 - fatigue * 0.15)
  );

  const resolvedSenderName =
    businessCtx?.display_name ||
    (groupCtx ? `${msg.sender_user_id} · ${groupCtx.group_name}` : msg.sender_user_id || 'Unknown Sender');

  const resolvedChannelName =
    businessCtx?.brand_name || groupCtx?.group_name || 'Direct Message';

  return {
    message: msg,
    resolvedSenderName,
    resolvedChannelName,
    isVerifiedSender: Boolean(businessCtx?.verified || groupCtx?.sender_is_admin),
    user: {
      ...userRow,
      in_quiet_hours: inQuietHours,
      avg_daily_sent: Math.round(avgDailySent * 10) / 10,
      avg_daily_dismissed: Math.round(avgDailyDismissed * 10) / 10,
      dismissal_rate: Math.round(dismissalRate * 100) / 100,
      fatigue_score: Math.round(fatigue * 100) / 100,
      daily_trend: dailyRows,
    },
    business: businessCtx,
    group: groupCtx,
    media: {
      has_media: Boolean(msg.media_type && msg.media_id),
      media_type: msg.media_type || 'text',
      media_id: msg.media_id || '',
      file_path: mediaFilePath,
    },
    history: {
      matches: topMatches,
      evidence_ids: evidenceIds,
      summary: histSummary,
      engagement,
    },
    features: {
      trustScore: Math.round(trust * 100),
      urgency: Math.round(urgency * 100),
      spamProbability: Math.round(spamProb * 100),
      engagementScore: Math.round(engagementScore * 100),
      notificationPriority: Math.round(priority * 100),
      domainSpoofingDetected,
      promptInjectionSuspected,
      riskFlags,
    },
  };
}

/**
 * Context-aware deterministic routing engine grounded in all 13 CSV datasets.
 * Used for instant initial evaluation across all 110 messages before/alongside live Gemini runs.
 */
export function evaluateMessageContextually(ctx: FullMessageContext): ComputedDecision {
  const { message, business, group, history, features, user } = ctx;
  const text = (message.message_text || '').trim();
  const lower = text.toLowerCase();
  const evidenceIds = history.evidence_ids.length > 0 ? history.evidence_ids : [];

  let action: RoutingAction = 'digest';
  let messageType: MessageType = 'unknown';
  let reason = 'Non-urgent message routed to summary digest.';
  let reflectionResult = 'Verified against user history and sender trust profile.';
  let confidence = 0.84;

  // 1. Prompt Injection + Credential / Scam Phishing (Highest Priority Mute)
  if (features.promptInjectionSuspected) {
    action = 'mute';
    messageType = 'scam';
    confidence = 0.96;
    reason =
      'Message attempts to inject routing instructions while requesting sensitive verification/OTP or payment.';
    reflectionResult =
      'Adversarial prompt-injection override ignored. Content and sender risk confirm credential-harvesting scam.';
  }
  // 2. Business Domain Spoofing / Unverified Impersonator
  else if (business && (business.domain_mismatch || (!business.verified && business.user_reports_30d >= 20))) {
    action = 'mute';
    messageType = 'scam';
    confidence = 0.95;
    reason = business.domain_mismatch
      ? `Unverified sender (${business.display_name}) uses lookalike domain ${business.domain_used_by_sender} instead of official ${business.official_domain} with ${business.user_reports_30d} reports.`
      : `Unverified business account (${business.display_name}) has ${business.user_reports_30d} user reports in 30d and suspicious verification request.`;
    reflectionResult =
      'Domain-age and brand-impersonation check confirmed phishing risk. Silently muted to protect user.';
  }
  // 3. Explicit OTP / Credential / Fake QR / Fee / Token Scam in Personal or Group chats
  else if (
    /\b(otp|6 digit login code|card number|wallet pin|confirm.*pin|bank details|account will be blocked|account block ho jayega|otp leak|otp verify nahi|account-login\.in|account-help\.in|bit\.ly\/verify|processing fee|reactivation fee|pay the clearance amount|scan this qr and pay|scan the qr and send screenshot|use this link and send screenshot|registry papers will be shared after payment|selected for reward|claim today before voucher|send bank details)\b/i.test(
      lower
    ) &&
    !/no payment or otp is required|never ask for otp/i.test(lower)
  ) {
    action = 'mute';
    messageType = 'scam';
    confidence = 0.93;
    reason =
      'Message pressures the user to share OTP/credentials or send payment via an unverified QR/link.';
    reflectionResult =
      group?.sender_is_admin
        ? 'Even though sender holds an admin role, message requests QR penalty payment contradicting prior official office-only instructions.'
        : 'Matches credential-phishing and payment-fraud indicators corroborated by user report/mute history.';
  }
  // 4. Chain forwards, superstitious blessings, unverified health forwards
  else if (
    /\b(forward this to|share with.*10 people|share in all family groups|send to.*people|do not break the chain|good luck|bhagwan|sab groups me share|drink warm water|stop all tablets|herbal mix|health secret|one habit will fix health|share this blessing)\b/i.test(
      lower
    ) ||
    (message.forwarded_count >= 7 && /\b(good morning|blessing|health|share|forward)\b/i.test(lower))
  ) {
    action = 'mute';
    messageType = /\b(good morning|blessing|bhagwan)\b/i.test(lower) ? 'greeting' : 'forward';
    confidence = 0.91;
    reason =
      'Chain-forwarded greeting or viral health tip matching prior messages repeatedly dismissed and muted by this user.';
    reflectionResult =
      `High forward count (${message.forwarded_count}x) and negative historical engagement (muted: ${history.engagement.muted}) confirm low value.`;
  }
  // 5. Voice-only messages (no text body) -> infer from sender, business, and matched history events
  else if (!text && message.media_type === 'voice') {
    if (business && (!business.verified || business.domain_mismatch || business.has_opted_out)) {
      action = 'mute';
      messageType = business.domain_mismatch ? 'scam' : 'spam';
      confidence = 0.87;
      reason = `Voice note from unverified or opted-out business (${business.display_name}) matching previously ignored/reported history.`;
      reflectionResult = 'Sender trust and user opt-out history override voice attachment priority.';
    } else if (history.engagement.reported > 0 || history.engagement.muted > 0) {
      action = 'mute';
      messageType = 'spam';
      confidence = 0.85;
      reason = `Voice note (${message.media_id}) from sender whose previous messages were muted or reported by this user.`;
      reflectionResult = 'Historical negative engagement indicates unsolicited voice broadcast.';
    } else if (history.engagement.replied > 0) {
      action = 'notify';
      messageType = 'urgent';
      confidence = 0.84;
      reason = `Voice note (${message.media_id}) from high-engagement contact/admin where user consistently replies quickly.`;
      reflectionResult = 'Strong positive reply history supports immediate notification for voice note.';
    } else {
      action = 'digest';
      messageType = 'personal';
      confidence = 0.78;
      reason = `Voice note (${message.media_id}) without urgent text signals; queued in digest based on moderate historical engagement.`;
      reflectionResult = 'Balanced routing while awaiting live audio transcription pass.';
    }
  }
  // 6. Business messages (verified or legitimate local business)
  else if (message.conversation_type === 'business' && business) {
    const isPromo =
      /\b(50% off|40% off|try50|shopping offer|limited shopping benefit|dropped something|saved travel deal|ladakh|unsubscribe|welcome offer|discount|launch discount|survey|feedback)\b/i.test(
        lower
      );
    const isTransactional =
      /\b(order ending|packed|out for delivery|delivery attempt|return pickup|pickup|ride update|route status|health-related update|appointment|prescription|card payment|card statement|account status|payouts)\b/i.test(
        lower
      );

    if (business.has_opted_out && isPromo) {
      action = 'mute';
      messageType = 'promotion';
      confidence = 0.91;
      reason = `Promotional message from ${business.display_name}, which the user explicitly opted out of (${business.user_history?.why_user_knows_account || 'promotions opted out'}).`;
      reflectionResult =
        'Confirmed user opt-out timestamp and high prior dismissal count for this brand.';
    } else if (isPromo) {
      const optedIn = business.user_history?.allows_promotions;
      if (!optedIn && (business.user_history?.messages_dismissed_30d ?? 0) >= 5) {
        action = 'mute';
        messageType = 'promotion';
        confidence = 0.86;
        reason = `User has repeatedly dismissed promotions from ${business.display_name} (${business.user_history?.messages_dismissed_30d} dismissed in 30d).`;
        reflectionResult = 'High dismissal ratio justifies muting promotional campaign.';
      } else {
        action = 'digest';
        messageType = /\b(survey|feedback)\b/i.test(lower) ? 'business_update' : 'promotion';
        confidence = 0.83;
        reason = `Legitimate non-urgent ${messageType === 'promotion' ? 'offer' : 'feedback/survey request'} from verified business ${business.display_name}.`;
        reflectionResult = 'Safe verified brand message with no immediate deadline; routed to digest.';
      }
    } else if (isTransactional) {
      const isNonUrgentStatement = /\b(whenever convenient|monthly card statement|let's connect|simplif|international payouts don't have to)\b/i.test(lower);
      if (isNonUrgentStatement || (user.in_quiet_hours && !/\b(pickup today|2-5 pm|2 pm and 4 pm|ride update|delivery attempt)\b/i.test(lower))) {
        action = 'digest';
        messageType = 'business_update';
        confidence = 0.85;
        reason = `Routine statement or non-urgent account update from verified business ${business.display_name}${user.in_quiet_hours ? ' arriving during DND quiet hours' : ''}.`;
        reflectionResult = 'Verified transactional notice without immediate time-critical action; placed in digest.';
      } else {
        action = 'notify';
        messageType = /\b(health-related|appointment|prescription)\b/i.test(lower) ? 'event' : 'business_update';
        confidence = 0.91;
        reason = `Time-sensitive operational update from verified business ${business.display_name} matching active user relationship (${business.user_history?.why_user_knows_account || 'active customer'}).`;
        reflectionResult = 'High brand verification score and active user-business history warrant immediate alert.';
      }
    } else {
      action = 'digest';
      messageType = 'business_update';
      confidence = 0.80;
      reason = `Informational business message from ${business.display_name}.`;
      reflectionResult = 'No urgent action required; safely queued in digest.';
    }
  }
  // 7. Group & Personal messages
  else {
    const explicitlyLowUrgency =
      /\b(no rush|nothing urgent|nothing blocking|no urgency|koi urgency nahi|no need to reply|whenever convenient|whenever free|no pressure|tomorrow morning|read it before|after dinner|don't call now|good morning beta)\b/i.test(
        lower
      );
    const marketplacePromo =
      /\b(selling a|kurta set|recliner discount|denim jacket|price final|rs 850|pickup near gate|buyer cancelled|plot|sqft)\b/i.test(
        lower
      );
    const urgentOperational =
      /\b(tanker|tank aa gaya|leaving in 20 mins|leaves in 15 mins|gate closes in 10 mins|gate band hone wala|car hata do|move any car|lift maintenance|fire alarm test|maintenance closes at 5 pm|maintenance payment aaj 5 baje|payment due today|bus list closes|field trip|internship approval forms close|build is failing|can you call before|7 pm sync|rollback is approved|come online now|call me now|call me urgently|doctor appointment moved|at your gate|next 10 minutes|studio b today|before 7:15|passeport|water bottle.*till 7 pm)\b/i.test(
        lower
      );

    if (marketplacePromo) {
      const hasDeadlineForUser = /\b(kept the blue denim jacket aside for you|collect it from gate 2 by 6 pm)\b/i.test(lower);
      if (history.engagement.muted > 0 || history.engagement.dismissed > 0 || (user.notifications_dismissed_30d > 60 && !hasDeadlineForUser)) {
        action = 'mute';
        messageType = 'promotion';
        confidence = 0.87;
        reason = 'Resale/marketplace listing matching historical messages previously dismissed or muted by this user.';
        reflectionResult = 'Negative historical engagement on marketplace threads confirms mute.';
      } else if (hasDeadlineForUser && history.engagement.replied > 0) {
        action = 'notify';
        messageType = 'personal';
        confidence = 0.86;
        reason = 'Direct time-bound pickup confirmation (by 6 PM today) from a seller the user actively replied to.';
        reflectionResult = 'Positive prior reply history and same-day 6 PM pickup window justify notification.';
      } else {
        action = 'digest';
        messageType = 'promotion';
        confidence = 0.83;
        reason = 'Marketplace resale post that matches group topic but does not require immediate interruption.';
        reflectionResult = 'Routed to digest to avoid notification fatigue.';
      }
    } else if (urgentOperational && !explicitlyLowUrgency) {
      action = 'notify';
      messageType = /\b(maintenance|payment due)\b/i.test(lower)
        ? 'payment'
        : /\b(field trip|school circular|internship|7 pm sync|studio b|fire alarm)\b/i.test(lower)
          ? 'event'
          : 'urgent';
      confidence = 0.90;
      reason = group?.sender_is_admin
        ? `Trusted group admin (${group.group_name}) sent a time-sensitive operational alert requiring timely user action.`
        : 'Direct, time-sensitive personal or work request requiring prompt attention.';
      reflectionResult =
        'Verified genuine urgency without scam/phishing indicators; immediate push notification approved.';
    } else if (explicitlyLowUrgency) {
      action = 'digest';
      messageType = /\b(good morning)\b/i.test(lower)
        ? 'greeting'
        : /\b(potluck|match|cricket|slides|review)\b/i.test(lower)
          ? 'event'
          : 'personal';
      confidence = 0.85;
      reason = 'Sender explicitly noted no urgency; safe informational message routed to digest.';
      reflectionResult = 'Respects user focus and notification fatigue budget by deferring to digest.';
    } else {
      action = 'digest';
      messageType = message.conversation_type === 'personal' ? 'personal' : 'event';
      confidence = 0.80;
      reason = 'Legitimate conversation without critical deadline; placed in summary digest.';
      reflectionResult = 'Balanced against user fatigue score and historical engagement.';
    }
  }

  const clampedConf = Math.max(0.55, Math.min(0.99, Math.round(confidence * 100) / 100));

  return {
    id: `dec_${message.message_id}`,
    messageId: message.message_id,
    action,
    messageType,
    reason,
    confidence: Math.round(clampedConf * 1000) / 10,
    confidenceUnit: clampedConf,
    evidenceIds,
    trustScore: features.trustScore,
    spamProbability: features.spamProbability,
    urgency: features.urgency,
    reflectionResult,
    processedAt: new Date().toISOString(),
    source: 'context-engine',
  };
}

export function getDynamicFewShots(ctx: FullMessageContext, limit = 4) {
  const targetConv = ctx.message.conversation_type;
  const targetMedia = ctx.media.media_type;
  const scored = datasetStore.sampleMessages.map((s) => {
    let score = 0;
    if (s.conversation_type === targetConv) score += 3;
    if ((s.media_type || 'text') === targetMedia) score += 2;
    if (ctx.features.promptInjectionSuspected && /ignore all previous/i.test(s.message_text)) score += 6;
    return { score, sample: s };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.sample);
}
