export const WorkflowAppRunLogs = ({
  appId,
  executionId,
}: { appId: string; executionId: string }) => {
  return (
    <div>
      WorkflowAppRunLogs: {appId} {executionId}
    </div>
  );
};
