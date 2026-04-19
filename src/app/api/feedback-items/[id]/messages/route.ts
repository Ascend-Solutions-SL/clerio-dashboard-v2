import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

type AuthUserProfile = {
  user_uid: string;
  first_name: string | null;
  last_name: string | null;
  user_initials: string | null;
  user_email: string | null;
};

type FeedbackMessageRow = {
  id: string;
  feedback_id: string;
  sender_id: string;
  message: string;
  attachments: string[] | null;
  created_at: string;
};

const FEEDBACK_BUCKET = 'feedback-attachments';

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const fallbackInitials = (raw: string | null | undefined) => {
  const value = normalizeSpaces(String(raw ?? ''));
  if (!value) {
    return 'US';
  }

  const chunks = value.split(/\s+/).filter(Boolean);
  if (chunks.length === 1) {
    return chunks[0].slice(0, 2).toUpperCase();
  }

  return `${chunks[0][0] ?? ''}${chunks[1][0] ?? ''}`.toUpperCase();
};

const deriveDisplayName = (profile: AuthUserProfile | undefined, fallbackId: string) => {
  if (!profile) {
    return `Usuario ${fallbackId.slice(0, 6)}`;
  }

  const fullName = normalizeSpaces(`${profile.first_name ?? ''} ${profile.last_name ?? ''}`);
  if (fullName) {
    return fullName;
  }

  if (profile.user_email) {
    return profile.user_email;
  }

  return `Usuario ${fallbackId.slice(0, 6)}`;
};

const deriveInitials = (profile: AuthUserProfile | undefined, fallbackId: string) => {
  if (profile?.user_initials) {
    return profile.user_initials.toUpperCase();
  }

  const fullName = normalizeSpaces(`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`);
  if (fullName) {
    return fallbackInitials(fullName);
  }

  if (profile?.user_email) {
    return fallbackInitials(profile.user_email.split('@')[0]);
  }

  return fallbackInitials(fallbackId.slice(0, 2));
};

const getFeedbackIdFromParams = async (context: { params: Promise<{ id: string }> }) => {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? '').trim();
};

const checkFeedbackAccess = async (feedbackId: string, userId: string) => {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('feedback_items')
    .select('id')
    .eq('id', feedbackId)
    .or(`user_id.eq.${userId},visibility.eq.public`)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500, message: error.message };
  }

  if (!data?.id) {
    return { ok: false as const, status: 403, message: 'Forbidden' };
  }

  return { ok: true as const };
};

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const feedbackId = await getFeedbackIdFromParams(context);
  if (!feedbackId) {
    return NextResponse.json({ error: 'Missing feedback id' }, { status: 400 });
  }

  const access = await checkFeedbackAccess(feedbackId, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('feedback_messages')
    .select('id, feedback_id, sender_id, message, attachments, created_at')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as FeedbackMessageRow[];
  const senderIds = Array.from(new Set(rows.map((row) => row.sender_id).filter(Boolean)));

  let profilesByUser = new Map<string, AuthUserProfile>();
  if (senderIds.length > 0) {
    const { data: profileRows } = await supabaseAdmin
      .from('auth_users')
      .select('user_uid, first_name, last_name, user_initials, user_email')
      .in('user_uid', senderIds);

    profilesByUser = new Map(((profileRows ?? []) as AuthUserProfile[]).map((profile) => [profile.user_uid, profile]));
  }

  const messages = rows.map((row) => {
    const profile = profilesByUser.get(row.sender_id);
    return {
      ...row,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      sender_display_name: deriveDisplayName(profile, row.sender_id),
      sender_initials: deriveInitials(profile, row.sender_id),
    };
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const feedbackId = await getFeedbackIdFromParams(context);
  if (!feedbackId) {
    return NextResponse.json({ error: 'Missing feedback id' }, { status: 400 });
  }

  const access = await checkFeedbackAccess(feedbackId, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const incoming = await request.formData();
  const message = typeof incoming.get('message') === 'string' ? String(incoming.get('message')).trim() : '';

  const attachmentFiles = incoming
    .getAll('attachments')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!message && attachmentFiles.length === 0) {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const attachmentUrls: string[] = [];
  for (const file of attachmentFiles) {
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? 'png' : 'png';
    const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${user.id}/messages/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

    const { error: uploadError } = await supabaseAdmin.storage.from(FEEDBACK_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(FEEDBACK_BUCKET).getPublicUrl(path);
    attachmentUrls.push(publicData.publicUrl);
  }

  const { data, error } = await supabaseAdmin
    .from('feedback_messages')
    .insert({
      feedback_id: feedbackId,
      sender_id: user.id,
      message: message || '[Adjunto]',
      attachments: attachmentUrls,
    })
    .select('id, feedback_id, sender_id, message, attachments, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profileRow } = await supabaseAdmin
    .from('auth_users')
    .select('user_uid, first_name, last_name, user_initials, user_email')
    .eq('user_uid', user.id)
    .maybeSingle();

  const profile = (profileRow ?? undefined) as AuthUserProfile | undefined;
  const result = {
    ...(data as FeedbackMessageRow),
    attachments: Array.isArray((data as FeedbackMessageRow).attachments) ? (data as FeedbackMessageRow).attachments : [],
    sender_display_name: deriveDisplayName(profile, user.id),
    sender_initials: deriveInitials(profile, user.id),
  };

  return NextResponse.json({ ok: true, message: result });
}
