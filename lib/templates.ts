import { supabaseAdmin } from './supabaseAdmin';

export type TemplateType = 'customer' | 'business_owner' | 'supplier';

export type EmailTemplate = {
  id: string;
  name: string;
  template_type: TemplateType | null;
  recipient_emails: string[] | null;
  project: any | null;
  html_published: string | null;
  preview_data: any | null;
  subject: string | null;
  language: string;
  created_at: string;
  updated_at: string;
};

export async function listTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as EmailTemplate[];
}

export async function createTemplate(
  name: string, 
  preview: any = null, 
  templateType: TemplateType | null = null,
  recipientEmails: string[] | null = null
) {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .insert({ 
      name, 
      preview_data: preview,
      template_type: templateType,
      recipient_emails: recipientEmails
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function getTemplate(id: string) {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function upsertProject(id: string, project: any) {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .update({ project })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function publishHtml(id: string, html: string) {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .update({ html_published: html })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function updatePreviewData(id: string, preview: any, subject?: string) {
  const updateData: any = { preview_data: preview };
  if (subject !== undefined) {
    updateData.subject = subject;
  }
  
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateTemplateConfig(
  id: string, 
  templateType: TemplateType | null, 
  recipientEmails: string[] | null
) {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .update({ 
      template_type: templateType,
      recipient_emails: recipientEmails
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function getTemplatesByType(templateType: TemplateType): Promise<EmailTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('template_type', templateType)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as EmailTemplate[];
}

export async function deleteTemplate(id: string) {
  const { error } = await supabaseAdmin
    .from('email_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}
