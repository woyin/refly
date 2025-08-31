import { AgentBaseToolset } from './base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { BuiltinToolset, BuiltinToolsetDefinition } from './builtin';
import { FirecrawlToolset, FirecrawlToolsetDefinition } from './firecrawl';
import { CalculatorToolset, CalculatorToolsetDefinition } from './calculator';
import { GoogleDriveToolset, GoogleDriveToolsetDefinition } from './google-drive';

export type AnyToolsetClass = new (...args: any[]) => AgentBaseToolset<any>;

export const toolsetInventory: Record<
  string,
  {
    class: AnyToolsetClass;
    definition: ToolsetDefinition;
  }
> = {
  [BuiltinToolsetDefinition.key]: {
    class: BuiltinToolset,
    definition: BuiltinToolsetDefinition,
  },
  [FirecrawlToolsetDefinition.key]: {
    class: FirecrawlToolset,
    definition: FirecrawlToolsetDefinition,
  },
  [CalculatorToolsetDefinition.key]: {
    class: CalculatorToolset,
    definition: CalculatorToolsetDefinition,
  },
  [GoogleDriveToolsetDefinition.key]: {
    class: GoogleDriveToolset,
    definition: GoogleDriveToolsetDefinition,
  },
};
