import { create } from 'zustand';
import type {
  Skill,
  SkillTemplateConfig,
  SkillRuntimeConfig,
  MediaType,
} from '@refly/openapi-schema';

export interface MediaQueryData {
  mediaType: MediaType;
  query: string;
  model: string;
  providerItemId: string;
}

interface FrontPageState {
  query: string;
  selectedSkill: Skill | null;
  tplConfig: SkillTemplateConfig | null;
  runtimeConfig: SkillRuntimeConfig | null;
  mediaQueryData: MediaQueryData | null;
  setQuery?: (query: string) => void;
  setSelectedSkill?: (skill: Skill | null) => void;
  setTplConfig?: (tplConfig: SkillTemplateConfig | null) => void;
  setRuntimeConfig?: (runtimeConfig: SkillRuntimeConfig | null) => void;
  setMediaQueryData?: (mediaQueryData: MediaQueryData | null) => void;
  reset?: () => void;
}

const initialState: FrontPageState = {
  query: '',
  selectedSkill: null,
  tplConfig: null,
  runtimeConfig: { disableLinkParsing: true, enabledKnowledgeBase: false },
  mediaQueryData: null,
};

export const useFrontPageStore = create<FrontPageState>((set) => ({
  ...initialState,
  setQuery: (query) => set({ query }),
  setSelectedSkill: (selectedSkill) => set({ selectedSkill }),
  setTplConfig: (tplConfig) => {
    set({ tplConfig });
  },
  setRuntimeConfig: (runtimeConfig) => set({ runtimeConfig }),
  setMediaQueryData: (mediaQueryData) => {
    set({ mediaQueryData });
  },
  reset: () => set(initialState),
}));

export const useFrontPageStoreShallow = (selector: (state: FrontPageState) => any) => {
  return useFrontPageStore(selector);
};
