// 共享类型定义

export type CategoryType = 'strength' | 'cardio' | 'recovery';

export interface Category {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  type: CategoryType | null; // 顶级分类使用，子项继承 parent.type
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export interface ExerciseRecord {
  id: string;
  user_id: string;
  started_at: string;
  duration_seconds: number;
  allocations: RecordAllocation[];
  note: string | null;
  created_at: string;
}

export interface RecordAllocation {
  category_id: string;
  seconds: number;
}

export interface UserSettings {
  id: string;
  user_id: string;
  level: number;
  strength_goal_min: number;
  cardio_goal_min: number;
  recovery_goal_min: number;
  updated_at: string;
}

// 顶级分类元数据
export const TOP_CATEGORIES: { type: CategoryType; name: string; defaultChildren: string[] }[] = [
  { type: 'strength', name: '力量训练', defaultChildren: ['肩背', '臀腿', '核心'] },
  { type: 'cardio', name: '有氧运动', defaultChildren: ['走路', '跳操'] },
  { type: 'recovery', name: '拉伸恢复', defaultChildren: [] },
];

export const TYPE_LABEL: Record<CategoryType, string> = {
  strength: '力量训练',
  cardio: '有氧运动',
  recovery: '拉伸恢复',
};

export const TYPE_COLOR: Record<CategoryType, string> = {
  strength: '#ef4444',
  cardio: '#10b981',
  recovery: '#8b5cf6',
};