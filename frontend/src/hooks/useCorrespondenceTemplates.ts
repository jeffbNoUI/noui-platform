import { useQuery } from '@tanstack/react-query';
import { correspondenceAPI } from '@/lib/correspondenceApi';
import type { CorrespondenceTemplate } from '@/types/Correspondence';

/** Fetch correspondence templates filtered by workflow stage category. */
export function useTemplatesByStage(stageCategory: string) {
  return useQuery<CorrespondenceTemplate[]>({
    queryKey: ['correspondence', 'templates', 'stage', stageCategory],
    queryFn: () => correspondenceAPI.listTemplates({ stage_category: stageCategory }),
    enabled: stageCategory.length > 0,
  });
}
