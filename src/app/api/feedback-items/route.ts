import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

type FeedbackItemStatus = 'enviado' | 'en_revision' | 'planificado' | 'en_progreso' | 'implementado' | 'rechazado';
type FeedbackItemType = 'mejora' | 'idea' | 'error';
type FeedbackVisibility = 'private' | 'public';

type FeedbackItemRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: FeedbackItemType;
  status: FeedbackItemStatus;
  historico_data: Record<string, FeedbackItemStatus> | null;
  visibility: FeedbackVisibility;
  is_primary: boolean;
  parent_id: string | null;
  duplicate_count: number;
  attachment_url: string | null;
  created_at: string;
};

type AuthUserProfile = {
  user_uid: string;
  first_name: string | null;
  last_name: string | null;
  user_initials: string | null;
  user_email: string | null;
};

const FEEDBACK_BUCKET = 'feedback-attachments';
const VALID_TYPES = new Set<FeedbackItemType>(['mejora', 'idea', 'error']);
const VALID_VISIBILITY = new Set<FeedbackVisibility>(['private', 'public']);

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

const parseBoolean = (value: string | null): boolean => {
  if (!value) {
    return false;
  }
  return value === '1' || value.toLowerCase() === 'true';
};

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const onlyMine = parseBoolean(request.nextUrl.searchParams.get('onlyMine'));
  const supabaseAdmin = getSupabaseAdminClient();

  let query = supabaseAdmin
    .from('feedback_items')
    .select('id, user_id, title, description, type, status, historico_data, visibility, is_primary, parent_id, duplicate_count, attachment_url, created_at')
    .order('created_at', { ascending: false })
    .limit(250);

  if (onlyMine) {
    query = query.eq('user_id', user.id);
  } else {
    query = query.or(`user_id.eq.${user.id},visibility.eq.public`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as FeedbackItemRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));

  let profilesByUser = new Map<string, AuthUserProfile>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabaseAdmin
      .from('auth_users')
      .select('user_uid, first_name, last_name, user_initials, user_email')
      .in('user_uid', userIds);

    profilesByUser = new Map(((profileRows ?? []) as AuthUserProfile[]).map((profile) => [profile.user_uid, profile]));
  }

  const childrenByParent = new Map<string, FeedbackItemRow[]>();
  rows.forEach((row) => {
    if (!row.parent_id) {
      return;
    }
    const list = childrenByParent.get(row.parent_id) ?? [];
    list.push(row);
    childrenByParent.set(row.parent_id, list);
  });

  const enriched = rows.map((row) => {
    const creatorProfile = profilesByUser.get(row.user_id);
    const mergedParticipants = (childrenByParent.get(row.id) ?? [])
      .map((child) => deriveInitials(profilesByUser.get(child.user_id), child.user_id))
      .filter(Boolean);
    const participantInitials = Array.from(new Set([deriveInitials(creatorProfile, row.user_id), ...mergedParticipants]));

    return {
      ...row,
      creator_display_name: deriveDisplayName(creatorProfile, row.user_id),
      creator_initials: deriveInitials(creatorProfile, row.user_id),
      participant_initials: participantInitials,
    };
  });

  return NextResponse.json({ items: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const incoming = await request.formData();

  const title = typeof incoming.get('title') === 'string' ? String(incoming.get('title')).trim() : '';
  const description = typeof incoming.get('description') === 'string' ? String(incoming.get('description')).trim() : '';
  const rawType = typeof incoming.get('type') === 'string' ? String(incoming.get('type')).trim().toLowerCase() : '';
  const rawVisibility =
    typeof incoming.get('visibility') === 'string' ? String(incoming.get('visibility')).trim().toLowerCase() : 'private';
  const attachment = incoming.get('attachment');

  if (!title) {
    return NextResponse.json({ error: 'Título requerido' }, { status: 400 });
  }

  if (!description) {
    return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 });
  }

  if (!VALID_TYPES.has(rawType as FeedbackItemType)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  if (!VALID_VISIBILITY.has(rawVisibility as FeedbackVisibility)) {
    return NextResponse.json({ error: 'Visibilidad inválida' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  let attachmentUrl: string | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    const extension = attachment.name.includes('.') ? attachment.name.split('.').pop()?.toLowerCase() ?? 'png' : 'png';
    const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

    const { error: uploadError } = await supabaseAdmin.storage.from(FEEDBACK_BUCKET).upload(path, attachment, {
      upsert: false,
      contentType: attachment.type || 'application/octet-stream',
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(FEEDBACK_BUCKET).getPublicUrl(path);
    attachmentUrl = publicData.publicUrl;
  }

  const payload = {
    user_id: user.id,
    title,
    description,
    type: rawType as FeedbackItemType,
    status: 'enviado' as FeedbackItemStatus,
    visibility: rawVisibility as FeedbackVisibility,
    is_primary: true,
    parent_id: null,
    duplicate_count: 0,
    attachment_url: attachmentUrl,
  };

  const { data, error } = await supabaseAdmin
    .from('feedback_items')
    .insert(payload)
    .select('id, user_id, title, description, type, status, historico_data, visibility, is_primary, parent_id, duplicate_count, attachment_url, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}
