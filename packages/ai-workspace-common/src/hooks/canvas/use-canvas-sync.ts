import { useMemo } from 'react';

export const useCanvasSync = () => {
  const undoManager = useMemo(() => {
    // TODO: Implement undo manager
    return {
      undo: () => {},
      redo: () => {},
    };
  }, []);

  return {
    undoManager,
  };
};
