import { describe, it, expect } from 'vitest';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { processQueryWithMentions } from './query-processor';

describe('processQueryWithMentions', () => {
  // Test data
  const mockWorkflowVariable: WorkflowVariable = {
    variableId: 'var-1',
    name: 'testVar',
    variableType: 'string',
    value: [{ type: 'text', text: 'hello world' }],
  };

  const mockResourceVariable: WorkflowVariable = {
    variableId: 'resource-1',
    name: 'resourceVar',
    variableType: 'resource',
    value: [{ type: 'text', text: 'resource content' }],
  };

  describe('basic functionality', () => {
    it('should return original query when no options provided', () => {
      const result = processQueryWithMentions('hello world');
      expect(result).toEqual({ query: 'hello world', resourceVars: [] });
    });

    it('should replace structured mentions with @name when replaceVars is false', () => {
      const result = processQueryWithMentions('@{type=var,id=var-1,name=testVar} hello', {
        replaceVars: false,
        variables: [mockWorkflowVariable],
      });
      expect(result).toEqual({
        query: '@testVar hello',
        resourceVars: [],
      });
    });

    it('should return empty query for empty input', () => {
      const result = processQueryWithMentions('');
      expect(result).toEqual({ query: '', resourceVars: [] });
    });
  });

  describe('structured mention format @{type=...,id=...,name=...}', () => {
    it('should replace variable mention with value when replaceVars is true', () => {
      const query = '@{type=var,id=var-1,name=testVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable],
      });
      expect(result.query).toBe('hello world');
      expect(result.resourceVars).toEqual([]);
    });

    it('should replace var mention with @name when replaceVars is false', () => {
      const query = '@{type=var,id=var-1,name=testVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: false,
        variables: [mockWorkflowVariable],
      });
      expect(result.query).toBe('@testVar');
      expect(result.resourceVars).toEqual([]);
    });

    it('should replace with name when variable not found', () => {
      const query = '@{type=var,id=non-existent,name=missingVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable],
      });
      expect(result.query).toBe('missingVar');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle resource type mentions', () => {
      const query = '@{type=resource,id=resource-1,name=resourceVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariable],
      });
      expect(result.query).toBe('resourceVar');
      expect(result.resourceVars).toEqual([mockResourceVariable]);
    });

    it('should handle multiple mentions', () => {
      const query =
        '@{type=var,id=var-1,name=testVar} and @{type=resource,id=resource-1,name=resourceVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable, mockResourceVariable],
      });
      expect(result.query).toBe('hello world and resourceVar');
      expect(result.resourceVars).toEqual([mockResourceVariable]);
    });
  });

  describe('legacy @variableName format', () => {
    describe('WorkflowVariable handling', () => {
      it('should replace string variable with value', () => {
        const query = '@testVar hello';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.query).toBe('hello world hello');
        expect(result.resourceVars).toEqual([]);
      });

      it('should replace string variable at the beginning of string', () => {
        const query = '@testVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.query).toBe('hello world');
        expect(result.resourceVars).toEqual([]);
      });

      it('should replace string variable in the middle of string', () => {
        const query = 'start @testVar end';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.query).toBe('start hello world end');
        expect(result.resourceVars).toEqual([]);
      });

      it('should replace string variable at the end of string', () => {
        const query = 'hello @testVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.query).toBe('hello hello world');
        expect(result.resourceVars).toEqual([]);
      });

      it('should handle resource variable by removing from query and adding to resourceVars', () => {
        const query = '@resourceVar hello';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockResourceVariable],
        });
        expect(result.query).toBe('hello');
        expect(result.resourceVars).toEqual([mockResourceVariable]);
      });

      it('should handle resource variable at the beginning of string', () => {
        const query = '@resourceVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockResourceVariable],
        });
        expect(result.query).toBe('');
        expect(result.resourceVars).toEqual([mockResourceVariable]);
      });

      it('should handle multiple variables', () => {
        const query = '@testVar and @resourceVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable, mockResourceVariable],
        });
        expect(result.query).toBe('hello world and');
        expect(result.resourceVars).toEqual([mockResourceVariable]);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle variable with no value', () => {
      const variableWithNoValue: WorkflowVariable = {
        variableId: 'empty-var',
        name: 'emptyVar',
        variableType: 'string',
        value: [],
      };

      const query = '@emptyVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithNoValue],
      });
      expect(result.query).toBe('');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle variable with empty text values', () => {
      const variableWithEmptyValue: WorkflowVariable = {
        variableId: 'empty-text-var',
        name: 'emptyTextVar',
        variableType: 'string',
        value: [
          { type: 'text', text: '' },
          { type: 'text', text: '   ' },
        ],
      };

      const query = '@emptyTextVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithEmptyValue],
      });
      expect(result.query).toBe('');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle multiple text values', () => {
      const variableWithMultipleValues: WorkflowVariable = {
        variableId: 'multi-var',
        name: 'multiVar',
        variableType: 'string',
        value: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
          { type: 'text', text: 'third' },
        ],
      };

      const query = '@multiVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithMultipleValues],
      });
      expect(result.query).toBe('first, second, third');
      expect(result.resourceVars).toEqual([]);
    });

    it('should ignore non-text value types', () => {
      const variableWithNonTextValues: WorkflowVariable = {
        variableId: 'non-text-var',
        name: 'nonTextVar',
        variableType: 'string',
        value: [
          { type: 'file', text: 'ignored' },
          { type: 'text', text: 'valid' },
        ] as any,
      };

      const query = '@nonTextVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithNonTextValues],
      });
      expect(result.query).toBe('valid');
      expect(result.resourceVars).toEqual([]);
    });
  });
});
