import mitt from 'mitt';

export type Events = {
  pilotStepCreate: {
    entityId: string;
    entityType: string;
    pilotStepId: string;
    pilotSessionId: string;
  };
};

export const pilotEmitter = mitt<Events>();
