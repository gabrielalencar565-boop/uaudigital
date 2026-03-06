export interface PmTask {
  id: string;
  project_id: string | null;
  client_id: string;
  title: string;
  description: string | null;
  priority: string;
  status_global: string;
  stage_current: string;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
  assignee_id: string | null;
  watchers: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  parent_task_id: string | null;
  cover_url: string | null;
  is_extra_demand: boolean;
  is_draft?: boolean;
}

export interface PmSubtask {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  stage: string;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  order_index: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface PmComment {
  id: string;
  task_id: string | null;
  subtask_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
}

export interface PmAttachment {
  id: string;
  task_id: string | null;
  subtask_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  public_url: string | null;
  created_at: string;
}

export interface PmProject {
  id: string;
  client_id: string;
  name: string;
  month_ref: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
