import type { FormProps } from '@rjsf/core';
import type { RJSFSchema } from '@rjsf/utils';
import { memo, useMemo } from 'react';
import { ReflyRjsfTheme } from './theme';

type SchemaDefaults = RJSFSchema;

const ThemedForm = ReflyRjsfTheme;

export const ReflyRjsfForm = memo(function ReflyRjsfForm<
  TFormData = Record<string, unknown>,
  TSchema extends SchemaDefaults = SchemaDefaults,
  TContext = unknown,
>(props: FormProps<TFormData, TSchema, TContext>) {
  const {
    className,
    noHtml5Validate = true,
    showErrorList = false,
    liveValidate = true,
    uiSchema = {},
    ...rest
  } = props;

  // Hide default submit button since we handle submission through pagination
  const finalUiSchema = useMemo(() => {
    const submitButtonOptions = uiSchema?.['ui:submitButtonOptions'] ?? {};

    return {
      ...uiSchema,
      'ui:submitButtonOptions': {
        ...submitButtonOptions,
        norender: true,
      },
    };
  }, [uiSchema]);

  const containerClassName = useMemo(() => {
    const segments = ['w-[680px]', 'h-[766px]'];

    if (className) {
      segments.push(className);
    }

    return segments.join(' ');
  }, [className]);

  return (
    <div className={containerClassName}>
      <ThemedForm
        {...rest}
        uiSchema={finalUiSchema}
        noHtml5Validate={noHtml5Validate}
        showErrorList={showErrorList}
        liveValidate={liveValidate}
      />
    </div>
  );
});

ReflyRjsfForm.displayName = 'ReflyRjsfForm';
