import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useNoteStore } from '@refly-packages/ai-workspace-common/stores/note';
import { useNavigate, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';

export const useKnowledgeBaseJumpNewPath = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const noteStore = useNoteStore();
  const knowledgeBaseStore = useKnowledgeBaseStore();
  const navigate = useNavigate();

  const jumpToNote = ({ noteId, baseUrl = '' }: { noteId; baseUrl?: string }, extraQuery?: Record<string, string>) => {
    searchParams.set('noteId', noteId);
    setSearchParams(searchParams);
    navigate(`${baseUrl}/knowledge-base?${searchParams.toString()}`);
    noteStore.updateNotePanelVisible(true);
    knowledgeBaseStore.updateResourcePanelVisible(false);
  };

  const jumpToKnowledgeBase = (
    { kbId, baseUrl = '' }: { kbId: string; baseUrl?: string },
    extraQuery?: Record<string, string>,
  ) => {
    searchParams.set('kbId', kbId);
    setSearchParams(searchParams.toString());
    navigate(`${baseUrl}/knowledge-base?${searchParams.toString()}`);
    knowledgeBaseStore.updateResourcePanelVisible(true);
    noteStore.updateNotePanelVisible(false);
  };

  const jumpToReadResource = ({ kbId, resId, baseUrl = '' }: { kbId: string; resId: string; baseUrl?: string }) => {
    searchParams.set('kbId', kbId);
    searchParams.set('resId', resId);
    setSearchParams(searchParams);
    navigate(`${baseUrl}/knowledge-base?${searchParams.toString()}`);
    knowledgeBaseStore.updateResourcePanelVisible(true);
  };

  const jumpToConv = ({ convId, baseUrl = '' }: { convId: string; baseUrl?: string }) => {
    searchParams.set('convId', convId);
    setSearchParams(searchParams);
    navigate(`${baseUrl}/knowledge-base?${searchParams.toString()}`);
  };

  return {
    jumpToNote,
    jumpToKnowledgeBase,
    jumpToReadResource,
    jumpToConv,
  };
};
